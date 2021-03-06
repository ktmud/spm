define(function(require) {

  var data = require('../data');

  data.sort(function() {
    return .5 - Math.random();
  });

  data.forEach(function(o, idx) {
    o.size = (o.size / 1024).toFixed(1) + 'K';
  });

  function $(id) {
    return document.getElementById(id);
  }

  function t(s, d) {
    for (var p in d){
      s = s.replace(new RegExp('{' + p + '}', 'g'), d[p]);
    }
    return s;
  }

  function find(tag) {
    if (!tag) return data;
    var results = [], i = data.length;
    while (i--) if (data[i].keywords.indexOf(tag) > -1) results.push(data[i]);
    return results;
  }

  function render(results) {
    var html = [], i = results.length;
    while (i--) {
      html.push(t('<li><a href="{homepage}"><div class="size">{size}</div><h3>{name}</h3>{description}</a></li>', results[i]));
    }
    $('results').innerHTML = html.join('');
  }


  var selectEl = $('ineed_select');

  function select(tag) {
    var options = selectEl.options, i = options.length;
    while (i--) {
      if (options[i].value == tag) {
        selectEl.selectedIndex = i;
      }
    }
  }

  selectEl['onchange'] = function() {
    var value = selectEl.options[selectEl.selectedIndex].value;
    var tag = '';
    if (value) {
      render(find(value));
      tag = '#' + value;
    }
    location.href = location.href.split('#')[0] + tag;
  };


  var hash = location.href.split('#');
  render(hash.length ? (select(hash[1]), find(hash[1])) : data);

});
