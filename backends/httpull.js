/*jshint node:true, laxcomma:true */

var util = require('util');
var http = require('http');
var fs = require('fs');

function HttpullBackend(startupTime, config, emitter) {
  var self = this;
  this.lastFlush = startupTime;
  this.lastException = startupTime;
  this.config = config.httpull || {};
  this.lastData = {};

  // attach
  emitter.on('flush', function(timestamp, metrics) { self.flush(timestamp, metrics); });
  emitter.on('status', function(callback) { self.status(callback); });

  var port = this.config.port || 9615;
  var url = this.config.url || '/';
  console.log('Httpull backend starting up at ' + port);
  http.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    if (req.url == url)
      res.end(JSON.stringify(self.lastData));
    else
      res.end('{"error":"not found"}');
  }).listen(port);
}

HttpullBackend.prototype.flush = function(timestamp, metrics) {
  // TODO: use redis so these don't get reset when statsd is reset.
  // also, we can never remove any counters from memory this way.
  var counters = this.lastData.counters || {};
  for (c in metrics.counters)
    counters[c] = (counters[c] || 0) + metrics.counters[c];

  var out = {
    counters: counters,
    timers: metrics.timers, // TODO
    gauges: metrics.gauges,
    timer_data: metrics.timer_data, // TODO
    counter_rates: metrics.counter_rates, // TODO
    sets: function(vals) { // TODO
      var ret = {};
      for (var val in vals) {
        ret[val] = vals[val].values();
      }
      return ret;
    }(metrics.sets),
    pctThreshold: metrics.pctThreshold
  };
  this.lastData = out;
};

HttpullBackend.prototype.status = function(write) {
  ['lastFlush', 'lastException'].forEach(function(key) {
    write(null, 'httpull', key, this[key]);
  }, this);
};

exports.init = function(startupTime, config, events) {
  var instance = new HttpullBackend(startupTime, config, events);
  return true;
};
