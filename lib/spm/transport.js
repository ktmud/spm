// vim: set tabstop=2 shiftwidth=2:

/**
 * @fileoverview transport external modules to seajs compatible code.
 * @author yyfrankyy@gmail.com (Frank Xu)
 */

var fs = require('fs'),
    path = require('path'),
    url = require('url'),
    annotation = require('./annotation'),
    extract = require('../sbuild/extract'),
    uglifyjs = require('../../support/uglify-js/uglify-js'),
    jsp = uglifyjs.parser.parse,
    pro = uglifyjs.uglify,
    util = require('../util'),
    console = require('./log'),
    webAPI = require('./webAPI');

const PLACEHOLDER = '/*{{code}}*/';
const MODULES_DIR = 'modules';
const DEFAULT_VERSION = '1.0.0';

function parseTemplate(text, callback) {
  var comments, template;

  template = text.replace(/\/\*\*([\s\S]*?)\*\/\s*/g, function(all) {
    comments = all;
    return '\n';
  });

  var meta = annotation.parse(comments);

  // compatible for npm package.json
  if (meta['package']) {
    util.readFromPath(meta['package'], function(config) {
      config = JSON.parse(config);

      for (var i in config) {
        if (i in meta) continue;
        meta[i] = config[i];
      }

      callback({
        meta: meta,
        template: template
      });

    });
  }

  // all config from transport files
  else {
    callback({
      meta: meta,
      template: template
    });
  }
}

// prepare for modules/{name}/{version}/
function prepareDir(name, version) {
  util.mkdirSilent(MODULES_DIR);

  var modDir = path.join(MODULES_DIR, name);
  util.mkdirSilent(modDir);

  var verDir = path.join(modDir, version || DEFAULT_VERSION);
  util.mkdirSilent(verDir);

  return verDir;
}

// transport result
function handleResult(meta, tmpl, data, suffix) {
  data = tmpl.split(PLACEHOLDER).join(data);
  var dir = prepareDir(meta.name, meta.version),
      name = meta.filename || meta.name;

  // FIXME
  // 先如此处理depends
  // 因为uglifyjs的parser会丢失注释
  // 暂时没找到从ast重新输出正确包含依赖结构的方法
  var deps = extract.getAstDependencies(jsp(tmpl));
  data = data.replace(/define\s*\(/, function(match) {
    return match + JSON.stringify(deps) + ', ';
  });

  var outputPath = path.join(dir, name + suffix);
  fs.writeFileSync(outputPath, data);
}

var metaData = [];

function updateMeta(meta, min) {
  var exists = false,
      stat = fs.statSync(min);
  meta.size = stat.size;
  metaData.forEach(function(m, i) {
    if (m.name === meta.name) {
      metaData[i] = meta;
      exists = true;
    }
  });
  if (!exists)
    metaData.push(meta);

  console.info('update %s into data.js', meta.name);
  webAPI.generate(metaData);
}

// entrance for building
function _build(tmpl) {

  tmpl = fs.readFileSync(tmpl).toString();

  parseTemplate(tmpl, function(o) {
    var meta = o.meta, stat;

    meta.tags = meta.tags ? meta.tags.split(/\s*,\s*/) : (meta.keywords || []);

    meta.name = meta.name.toLowerCase();

    tmpl = o.template;

    var srcSuffix = '-debug.js', minSuffix = '.js',
        name = meta.filename || meta.name;

    var dir = prepareDir(meta.name, meta.version),
        src = path.join(dir, name + srcSuffix),
        min = path.join(dir, name + minSuffix);

    if (path.existsSync(src)) {
      console.warn('%s already exists, ignore.', src);
      console.warn('Update version information in the transport.js ');
      console.warn('if you want to upgrade to a new version.');

      updateMeta(meta, min);

      return;
    }

    if (meta.src) {
      util.readFromPath(meta.src, function(data) {
        handleResult(meta, tmpl, data, srcSuffix);

        stat = fs.statSync(src);

        console.info(
            'done building %s source code. size: %s',
            meta.name, stat.size);

        // minify
        if (!meta.min) {
          console.warn(
              '%s has no minified source, use uglify to minify.',
              meta.name
          );
          var source = fs.readFileSync(src).toString();
          fs.writeFileSync(min, pro.gen_code(jsp(source)));

          updateMeta(meta, min);

          console.info(
              'done building %s minified code, size: %s',
              meta.name, stat.size);
        }
      });
    }

    if (meta.min) {
      util.readFromPath(meta.min, function(data) {
        handleResult(meta, tmpl, data, minSuffix);

        updateMeta(meta, min);

        console.info(
            'done building %s minified code. size: %s',
            meta.name, meta.size);
      });
    }
  });
}

function build(mod) {
  var tmpl = path.join(MODULES_DIR, mod, 'transport.js');
  if (path.existsSync(tmpl)) {
    console.info('start building %s..', mod);
    console.info('found %s', tmpl);
    console.info('building %s', mod);
    _build(tmpl);
  } else {
    console.warn('%s does not exist, ignore.', tmpl);
  }
}

function buildAll() {
  console.info('start building all modules..');
  fs.readdirSync(MODULES_DIR).forEach(build);
}

exports.build = build;
exports.buildAll = buildAll;
