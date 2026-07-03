// Vercel serverless function: proxies DrawShield API over HTTPS
// Deployed at https://darbycollective.com/api/arms

const http = require('http');

const BLAZON = encodeURIComponent(
  'Argent, a chevron Sable between three Garbs Sable banded Or ' +
  'achievement crest an antelope head erased Gules maned and attired Or ' +
  'motto "Ut cunque placuerit Deo"'
);

const DRAWSHIELD_URL =
  `http://drawshield.net/include/drawshield.php?blazon=${BLAZON}&size=500&outputformat=svg`;

module.exports = async (req, res) => {
  return new Promise((resolve, reject) => {
    const request = http.get(DRAWSHIELD_URL, (upstream) => {
      // If DrawShield redirects, follow manually
      if (upstream.statusCode === 301 || upstream.statusCode === 302) {
        const location = upstream.headers.location;
        // Re-append our blazon if the redirect dropped it
        const redirectUrl = location.includes('blazon=')
          ? location
          : `${location}?blazon=${BLAZON}&size=500`;

        http.get(redirectUrl, (final) => {
          const chunks = [];
          final.on('data', chunk => chunks.push(chunk));
          final.on('end', () => {
            const svg = Buffer.concat(chunks).toString();
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.status(200).send(svg);
            resolve();
          });
        }).on('error', reject);
        return;
      }

      const chunks = [];
      upstream.on('data', chunk => chunks.push(chunk));
      upstream.on('end', () => {
        const svg = Buffer.concat(chunks).toString();
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(svg);
        resolve();
      });
    });

    request.on('error', (err) => {
      // Fallback: serve cached SVG from GitHub
      res.setHeader('Content-Type', 'text/plain');
      res.status(502).send(`DrawShield unavailable: ${err.message}`);
      resolve();
    });

    request.setTimeout(8000, () => {
      request.destroy();
      res.status(504).send('DrawShield timeout');
      resolve();
    });
  });
};
