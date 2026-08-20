const https = require('https');
https.get('https://api.github.com/repos/centinela-ia-argentina/centinela-ia-documentos/actions/runs/32319820834/jobs', {headers: {'User-Agent': 'Node.js'}}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log(data));
});
