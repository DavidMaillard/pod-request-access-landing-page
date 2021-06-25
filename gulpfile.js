// jshint esversion: 6
// jshint node: true
"use strict";

// package vars
const pkg = require("./package.json");

// gulp
const gulp = require("gulp");

// load all plugins in "devDependencies" into the variable $
const $ = require("gulp-load-plugins")({
  pattern: ["*"],
  scope: ["devDependencies"]
});

/**
 * Notifications
 */
var notify = $.notify;
notify.logLevel(0);

var onError = function(err) {

  notify.onError({
    sound:   'Beep',
    title:   'Gulp error',
    message: '<%= error.message %>'
  })(err);

  console.log(err.messageFormatted);

  this.emit('end');

};

// Our banner
const banner = (function() {
  let result = "";
  try {
    result = [
      "/**",
      " * @project        <%= pkg.name %>",
      " * @author         <%= pkg.author %>",
      " * @build          " + $.moment().format("llll") + " ET",
      " * @release        " + $.gitRevSync.long() + " [" + $.gitRevSync.branch() + "]",
      " * @copyright      Copyright (c) " + $.moment().format("YYYY") + ", <%= pkg.copyright %>",
      " *",
      " */",
      ""
    ].join("\n");
  }
  catch (err) {
  }
  return result;
})();

// scss - build the scss to the build folder, including the required paths, and writing out a sourcemap
gulp.task("scss", () => {
  $.fancyLog("-> Compiling scss");
  return gulp.src(pkg.paths.src.scss + pkg.vars.scssName)
    .pipe($.plumber({errorHandler: onError}))
    .pipe($.sourcemaps.init({loadMaps: true}))
    .pipe($.sass({
      includePaths: pkg.paths.scss
    })
      .on("error", $.sass.logError))
    .pipe($.cached("sass_compile"))
    .pipe($.autoprefixer({ browsers: ['last 2 versions', 'ie 9-11'], cascade: false }))
    .pipe($.sourcemaps.write("./"))
    .pipe($.size({gzip: true, showFiles: true}))
    .pipe(gulp.dest(pkg.paths.build.css));
});

// css task - combine & minimize any distribution CSS into the public css folder, and add our banner to it
gulp.task("css", [ "scss"], () => {
  $.fancyLog("-> Building css");
  return gulp.src(pkg.globs.distCss)
    .pipe($.plumber({errorHandler: onError}))
    .pipe($.newer({dest: pkg.paths.dist.css + pkg.vars.siteCssName}))
    .pipe($.print())
    .pipe($.replace("url('../fonts/fontello.", "url('/fonts/fontello."))
    .pipe($.sourcemaps.init({loadMaps: true}))
    .pipe($.concat(pkg.vars.siteCssName))
    .pipe($.if(process.env.NODE_ENV === "production",
      $.cssnano({
        discardComments: {
          removeAll: true
        },
        discardDuplicates: true,
        discardEmpty: true,
        minifyFontValues: true,
        minifySelectors: true
      })
    ))
    .pipe($.header(banner, {pkg: pkg}))
    .pipe($.sourcemaps.write("./"))
    .pipe($.size({gzip: true, showFiles: true}))
    .pipe(gulp.dest(pkg.paths.dist.css))
    .pipe($.filter("**/*.css"))
    .pipe($.livereload());
});

// js task - minimize any distribution Javascript into the public js folder, and add our banner to it
gulp.task("js-app", () => {
  $.fancyLog("-> Building js-app");

  if (process.env.NODE_ENV === "production") {
    const browserifyMethod = $.browserify;
  } else {
    const browserifyMethod = $.browserifyIncremental;
  }

  const bundleStream = browserifyMethod(pkg.paths.src.jsApp, {
    paths: pkg.globs.jsIncludes,
    cacheFile: pkg.paths.build.base + "browserify-cache.json"
  })
    .transform($.babelify, {presets: ["es2015"]})
    .transform($.vueify)
    .bundle();

  return bundleStream
    .pipe($.plumber({errorHandler: onError}))
    .pipe($.vinylSourceStream("app.js"))
    .pipe($.if(process.env.NODE_ENV === "production",
      $.streamify($.uglify())
    ))
    .pipe($.streamify($.header(banner, {pkg: pkg})))
    .pipe($.streamify($.size({gzip: true, showFiles: true})))
    .pipe(gulp.dest(pkg.paths.dist.js));

});

// babel js task - transpile our Javascript into the build directory
gulp.task("js-babel", ["custom-js"], () => {
  $.fancyLog("-> Transpiling Javascript via Babel...");
  return gulp.src(pkg.globs.babelJs)
    .pipe($.plumber({errorHandler: onError}))
    .pipe($.newer({dest: pkg.paths.build.js}))
    .pipe($.babel())
    .pipe($.size({gzip: true, showFiles: true}))
    .pipe(gulp.dest(pkg.paths.build.js));
});

// jsVendors task
// "./src/js/vendors/*.js"
// "./build/js/custom/"
// Takes all the /src/js/vendors/ js files
// and brings it to the /build/js/custom/
gulp.task("js-vendors", () => {
  $.fancyLog("-> Transpiling Vendors...");
  return gulp.src(pkg.globs.jsVendors)
    .pipe($.plumber({errorHandler: onError}))
    .pipe(gulp.dest(pkg.paths.build.customJs));
});

// babel js task - transpile our Javascript into the build directory
// "./src/js/site/**/*.js"
// "./build/js/custom/"
// "./build/js/custom/"
gulp.task("custom-js-babel", ["js-vendors"], () => {
  $.fancyLog("-> Transpiling Custom Javascript via Babel...");
  return gulp.src(pkg.globs.babelCustomJs)
    .pipe($.plumber({errorHandler: onError}))
    .pipe($.newer({dest: pkg.paths.build.customJs}))
    .pipe($.babel())
    .pipe($.size({gzip: true, showFiles: true}))
    .pipe(gulp.dest(pkg.paths.build.customJs));
});

// inline js task - minimize the inline Javascript into _inlinejs in the templates path
gulp.task("js-inline", ["js-babel"], () => {
  $.fancyLog("-> Copying inline js");
  return gulp.src(pkg.globs.inlineJs)
    .pipe($.plumber({errorHandler: onError}))
    .pipe($.if(["*.js", "!*.min.js"],
      $.newer({dest: pkg.paths.templates + "_inlinejs", ext: ".min.js"}),
      $.newer({dest: pkg.paths.templates + "_inlinejs"})
    ))
    .pipe($.if(["*.js", "!*.min.js"],
      $.uglify()
    ))
    .pipe($.if(["*.js", "!*.min.js"],
      $.rename({suffix: ".min"})
    ))
    .pipe($.size({gzip: true, showFiles: true}))
    .pipe(gulp.dest(pkg.paths.templates + "_inlinejs"))
    .pipe($.filter("**/*.js"))
  // .pipe($.livereload());
});

// js task - minimize any distribution Javascript into the public js folder, and add our banner to it
gulp.task("js", ["js-inline"], () => {
  $.fancyLog("-> Building js");

  let pkgGlobsDistJs = pkg.globs.distJsDev;
  if (process.env.NODE_ENV === "production") {
    pkgGlobsDistJs = pkg.globs.distJs;
  }

  return gulp.src(pkg.globs.distJs)
    .pipe($.plumber({errorHandler: onError}))
    .pipe($.if(["*.js", "!*.min.js"],
      $.newer({dest: pkg.paths.dist.js, ext: ".min.js"}),
      $.newer({dest: pkg.paths.dist.js})
    ))
    .pipe($.if(["*.js", "!*.min.js"],
      $.uglify()
    ))
    .pipe($.if(["*.js", "!*.min.js"],
      $.rename({suffix: ".min"})
    ))
    .pipe($.header(banner, {pkg: pkg}))
    .pipe($.size({gzip: true, showFiles: true}))
    .pipe(gulp.dest(pkg.paths.dist.js))
    .pipe($.filter("**/*.js"))
    .pipe($.livereload());
});

// custom-js task - combine & minimize any custom JS into the public js folder, and add our banner to it
gulp.task("custom-js", ["custom-js-babel"], () => {
  $.fancyLog("-> Building site JS");
  return gulp.src(pkg.globs.distCustomJs)
    .pipe($.plumber({errorHandler: onError}))
    .pipe($.newer({dest: pkg.paths.dist.customJs + pkg.vars.siteJsName}))
    .pipe($.print())
    .pipe($.sourcemaps.init({loadMaps: true}))
    .pipe($.uglify())
    .pipe($.concat(pkg.vars.siteJsName))
    .pipe($.header(banner, {pkg: pkg}))
    .pipe($.sourcemaps.write("./"))
    .pipe($.size({gzip: true, showFiles: true}))
    .pipe(gulp.dest(pkg.paths.dist.js))
    .pipe($.filter("**/*.js"))
    .pipe($.livereload());
});

// Process data in an array synchronously, moving onto the n+1 item only after the nth item callback
function doSynchronousLoop(data, processData, done) {
  if (data.length > 0) {
    const loop = (data, i, processData, done) => {
      processData(data[i], i, () => {
        if (++i < data.length) {
          loop(data, i, processData, done);
        } else {
          done();
        }
      });
    };
    loop(data, 0, processData, done);
  } else {
    done();
  }
}

// Process the critical path CSS one at a time
function processCriticalCSS(element, i, callback) {
  const criticalSrc = pkg.urls.critical + element.url;
  const criticalDest = pkg.paths.templates + element.template + "_critical.min.css";

  let criticalWidth = 1200;
  let criticalHeight = 1200;
  if (element.template.indexOf("amp_") !== -1) {
    criticalWidth = 600;
    criticalHeight = 19200;
  }
  $.fancyLog("-> Generating critical CSS: " + $.chalk.cyan(criticalSrc) + " -> " + $.chalk.magenta(criticalDest));
  $.critical.generate({
    src: criticalSrc,
    dest: criticalDest,
    penthouse: {
      blockJSRequests: false,
      forceInclude: pkg.globs.criticalWhitelist
    },
    inline: false,
    ignore: [],
    css: [
      pkg.paths.dist.css + pkg.vars.siteCssName,
    ],
    minify: true,
    width: criticalWidth,
    height: criticalHeight
  }, (err, output) => {
    if (err) {
      $.fancyLog($.chalk.magenta(err));
    }
    callback();
  });
}

// Process the downloads one at a time
function processDownload(element, i, callback) {
  const downloadSrc = element.url;
  const downloadDest = element.dest;

  $.fancyLog("-> Downloading URL: " + $.chalk.cyan(downloadSrc) + " -> " + $.chalk.magenta(downloadDest));
  $.download(downloadSrc)
    .pipe(gulp.dest(downloadDest));
  callback();
}

// Run pa11y accessibility tests on each template
function processAccessibility(element, i, callback) {
  const accessibilitySrc = pkg.urls.critical + element.url;
  const cliReporter = require("./node_modules/pa11y/reporter/cli.js");
  const options = {
    log: cliReporter,
    ignore:
      [
        "notice",
        "warning"
      ],
  };
  const test = $.pa11y(options);

  $.fancyLog("-> Checking Accessibility for URL: " + $.chalk.cyan(accessibilitySrc));
  test.run(accessibilitySrc, (error, results) => {
    cliReporter.results(results, accessibilitySrc);
    callback();
  });
}

// accessibility task
gulp.task("a11y", (callback) => {
  doSynchronousLoop(pkg.globs.critical, processAccessibility, () => {
    // all done
    callback();
  });
});

// imagemin task
gulp.task("imagemin", () => {
  $.fancyLog("-> Minimizing images in " + pkg.paths.src.img);
  return gulp.src(pkg.paths.src.img + "**/*.{png,jpg,jpeg,gif,svg}")
    .pipe($.imagemin({
      progressive: true,
      interlaced: true,
      optimizationLevel: 7,
      svgoPlugins: [{removeViewBox: false}],
      verbose: true,
      use: []
    }))
    .pipe(gulp.dest(pkg.paths.dist.img));
});

gulp.task("serve", ["css"], () => {
  $.fancyLog("-> Livereload listening for changes");
  $.livereload.listen();
  gulp.watch([pkg.paths.src.scss + "**/*.scss"], ["css"]);
  gulp.watch([pkg.paths.src.css + "**/*.css"], ["css"]);
  gulp.watch([pkg.paths.src.js + "**/*.js"], ["js"]);
  gulp.watch([pkg.paths.src.img + "**/*.{jpg,png,svg}"], ["generate"]);
  gulp.watch([pkg.paths.templates + "**/*.{html,htm,php}"], () => {
    gulp.src(pkg.paths.templates)
      .pipe($.plumber({errorHandler: onError}))
      .pipe($.livereload());
  });
});

// Generate assets task
gulp.task("generate", ["css"], () => {
  $.fancyLog("-> Generating app assets");
});
