const https = require('https');
function fetchUrl(url) {
  https.get(url, {headers: {'User-Agent': 'Node.js'}}, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      fetchUrl(res.headers.location);
    } else {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => console.log(data));
    }
  });
}
fetchUrl('https://api.github.com/repos/centinela-ia-argentina/centinela-ia-documentos/actions/jobs/96279597138/logs');
