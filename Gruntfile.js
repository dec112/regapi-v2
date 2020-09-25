/// <binding BeforeBuild='debug' />
/* global module:false */

module.exports = function (grunt) {

	var DEFAULT_PREAMBLE =
		'/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
		'(c) Copyright <%= pkg.author %> - ' +
		'<%= grunt.template.today("yyyy-mm-dd") %>, see LICENSE file */\n';

    // Project configuration
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        // see https://github.com/gruntjs/grunt-contrib-clean
        clean: {
            debug: [ 'dist' ]
        },

        // see https://github.com/gruntjs/grunt-contrib-uglify
        uglify: {
            debug_server: {
                options: {
                    banner: DEFAULT_PREAMBLE,
                    mangle: false,
                    compress: false,
                    sourceMap: false,
                    report: 'min',
                    beautify: true
                },
                files: [
                    {
                        expand: true,
                        cwd: 'source/server',
                        src: [
                            '**/*.js',
                            '!config/env/development.js'
                        ],
                        dest: 'dist'
                    }
                ]
            },
        },

		// see: https://github.com/gruntjs/grunt-contrib-requirejs
		requirejs: {
			debug_client: {
				options: {
					baseUrl: 'source/client/assets/js/',
					mainConfigFile: 'source/client/assets/js/main.js',
					name: 'main',
					out: 'dist/docs/assets/js/app.js',
					optimize: "uglify",
					uglify2: {
						toplevel: true,
						ascii_only: true,
						beautify: true,
						max_line_length: 1000,
						defines: {
							DEBUG: ['name', 'false']
						},
						no_mangle: true
					},
					generateSourceMaps: false,
					optimizeCss: 'standard.keepLines',
					paths: {
						requireLib: '../../../../bower_components/requirejs/require',
						jquery: '../../../../bower_components/jquery/dist/jquery',
						bootstrap: '../../../../bower_components/bootstrap/dist/js/bootstrap'
					},
					include: 'requireLib'
				}
			}
		},

        // see https://github.com/gruntjs/grunt-contrib-htmlmin
        htmlmin: {
            debug_client: {
                options: {
                    removeComments: false,
                    collapseWhitespace: false,
                    removeOptionalTags: false
                },
                files: {
                    // views
                    'dist/views/verify_ok.html': 'source/client/views/verify_ok.html',
                    'dist/views/verify_p.html': 'source/client/views/verify_p.html',
                    'dist/views/verify_e.html': 'source/client/views/verify_e.html'
                }
            }
        },

        // see https://github.com/gruntjs/grunt-contrib-cssmin
        cssmin: {
            debug_client: {
                options: {
                    //level: 0,
                    format: 'beautify',
                },
                files: {
                    'dist/docs/assets/css/app.css': [
                        'bower_components/bootstrap/dist/css/bootstrap.css',
                        'source/client/assets/css/app.css'
                    ]
                }
            }
        },

		// see https://github.com/gruntjs/grunt-contrib-copy
		copy: {
            debug_server: {
                files: [
                    { src: [ 'package.json' ], dest: 'dist/package.json' },
                    {
                        cwd: 'source/server/config/env',
                        expand: true,
                        src: [
                            'development.js'
                        ],
                        dest: 'dist/config/env'
                    },
                    { src: [ 'source/server/favicon.ico' ], dest: 'dist/favicon.ico' },
                    {
                        expand: true,
                        cwd: 'source/server/docs',
                        src: '**/*',
                        dest: 'dist/docs'
                    },
                    {
						expand: true,
						cwd: 'source/server/views',
						src: '**/*',
                        dest: 'dist/views'
					},
					// Uncomment to include modules
                    //{
					//	cwd: 'node_modules',
					//	expand: true,
					//	src: '**/*',
					//	dest: 'dist/node_modules'
					//}
                ]
            },
            debug_client: {
                files: [
                    { expand: true, cwd: 'source/client/assets/fonts',
                        src: '**/*', dest: 'dist/docs/assets/fonts' },
                    { expand: true, cwd: 'source/client/assets/images',
                        src: '**/*', dest: 'dist/docs/assets/images' },
                    { expand: true, cwd: 'bower_components/bootstrap/fonts',
                        src: '**/*', dest: 'dist/docs/assets/fonts' }
                ]
            }
		},

        // see https://github.com/gruntjs/grunt-contrib-compress
        compress: {
            zip_dev: {
                options: {
                    archive: './releases/<%= pkg.name %>-<%= pkg.version %>-dev.zip',
                    mode: 'zip'
                },
                files: [
                    { src: './gpl-3.0.txt' },
                    { src: './LICENSE' },
                    { src: './readme.md' },
                    { src: './docs/**' },
                    { src: './start_server.*' },
                    { src: './dist/**' },
                    { src: './install/**' }
                ]
            }
        }
    });

    // Load Grunt plugins.
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-uglify-es');
	grunt.loadNpmTasks('grunt-contrib-htmlmin');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.loadNpmTasks('grunt-contrib-requirejs');

    // Tasks
    grunt.registerTask('createDirectories', function (d) {
        grunt.file.mkdir('dist');
        grunt.file.mkdir('dist/docs');
    });

    grunt.registerTask('debug', [
        'clean:debug',
        'createDirectories',

        'copy:debug_server',
        'uglify:debug_server',

        'copy:debug_client',
        'cssmin:debug_client',
        'htmlmin:debug_client',
        'requirejs:debug_client',

        'compress:zip_dev'
    ]);

    grunt.registerTask('default', ['debug']);
    grunt.registerTask('build', ['debug']);
};

