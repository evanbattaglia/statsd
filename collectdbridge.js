var MINUTES_CLEANUP = 5;
var MINUTES_STALEDATA = 60 * 24;
var PATH = '/fillmein';

//////////////////////////////////////////

var http = require('http');

var metrics = {};

function cleanup() {
  var ms_staledata = MINUTES_STALEDATA * 60 * 1000;
  for (key in metrics)
    if (Date.now() - (metrics[key].timestamp * 1000) > ms_staledata)
      delete metrics[key];
}
setInterval(cleanup, MINUTES_CLEANUP * 60 * 1000);

function handlePost(req, res) {
  var fullBody = '';
  req.on('data', function(chunk) { fullBody += chunk.toString(); });
  req.on('end', function() {
    fullBody.split(/\r?\n/).forEach(function(line) {
      // http://rubular.com/r/kS4qLjGrXC
      var match;
      if (match = line.match(/^\s*PUTVAL\s+([^\s"]+|("([^\\"]|\\")*"))\s(.*\s)?([0-9\.0]+):([0-9\-.:]+)$/)) {
        // If quoted, remove quotes and change internal backslash quotes to quotes
        var id = match[1].replace(/^"/, '').replace(/"$/, '').replace('\\"', '"');
        var timestamp = parseInt(match[5]);
        var values = match[6].split(':').map(function(v) { return parseFloat(v) });

        metrics[id] = { timestamp: timestamp, values: values };
      }
    });

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{"success":"ok"}');
  });
}

function handleGet(req, res) {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(metrics));
}

http.createServer(function(req, res) {
  if (req.url != PATH) {
    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end('{"error","not found"}');
  } else if (req.method == 'POST')
    handlePost(req, res);
  else
    handleGet(req, res);
}).listen(9615);
