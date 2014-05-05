/*jshint node:true, laxcomma:true */

var util = require('util');
var http = require('http');
var fs = require('fs');
var redis = require('redis');

function HttpullBackend(startupTime, config, emitter) {
  var self = this;
  this.lastFlush = startupTime;
  this.lastException = startupTime;
  this.config = config.httpull || {};
  this.config.redisKey = config.redisKey || 'statsd:httpull';
  var redisKeyCounters = this.config.redisKeyCounters = this.config.redisKey + ':counters';
  this.lastData = {};
  var redisClient = this.redisClient = redis.createClient();

  // attach
  emitter.on('flush', function(timestamp, metrics) { self.flush(timestamp, metrics); });
  emitter.on('status', function(callback) { self.status(callback); });

  var port = this.config.port || 9615;
  var url = this.config.url || '/';

  console.log('Httpull backend starting up at ' + port);

  http.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});

    if (req.url == url) {
      redisClient.hgetall(redisKeyCounters, function(err, reply) {
        for (key in reply)
          reply[key] = parseInt(reply[key]);
        self.lastData.counters = reply;
        res.end(JSON.stringify(self.lastData));
      });
    } else
      res.end('{"error":"not found"}');
  }).listen(port);
}

HttpullBackend.prototype.flush = function(timestamp, metrics) {
  var counters = this.lastData.counters || {};
  for (c in metrics.counters) {
    var val = metrics.counters[c];
    if (val > 0) {
      console.log(this.config.redisKeyCounters + " ; " + c + " ; " + val);
      this.redisClient.hincrby([this.config.redisKeyCounters, c, val], function() {});
    }
  }

  var out = {
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
