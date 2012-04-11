'use strict';

var _ = require( 'underscore' ),
    async = require( 'async'),
    fs = require( 'fs' ),
    Git = require( './git'),
    path = require( 'path' ),
    rimraf = require( 'rimraf' );

var repoBaseDir = path.normalize( process.env.REPO_BASE_DIR ),
    workBaseDir = path.normalize ( process.env.WORK_BASE_DIR );


function fetch( repoDir, callback ) {
    Git( repoDir );
    Git.exec( [ "fetch" ], callback );
}

function cleanup( project, callback ) {
    var compiled = project.getCompiledDirSync();

    async.series([
        function( next ) {
            rimraf( compiled, next );
        },
        function( next ) {
            fs.mkdir( compiled, next );
        }
//        ,
//        function( next ) {
//            var wsDir = getWorkspaceDirSync( project ),
//                filterPath;
//            for ( filterPath in filters[ wsDir ] ) {
//                delete require.cache[ filterPath ];
//                delete filters[ wsDir ][ filterPath ];
//            }
//            dependenciesPromises = {};
//            bundlePromises = {};
//            next();
//        }
    ], callback );
}

function checkout( project, force, callback ){
    if ( typeof force === "function" ) {
        callback = force;
        force = false;
    }

    // Workspace
    var workDir  = getWorkspaceDirSync( project );

    path.exists( workDir, function( exists ) {
        if ( exists || force ) {
            async.waterfall([
                function( next ) {
                    fs.mkdir( workDir, function( err ) {
                        if ( err && err.code != "EEXIST" ) {
                            next( err );
                        } else {
                            next( null );
                        }
                    });
                },
                function( next ) {
                    project.getRepoDir( next );
                },
                function( dir, next ) {
                    Git( dir, workDir );
                    Git.exec( [ "checkout", "-f", project.getRef() ], next );
                },
                function( out, next ) {
                    project.cleanup( next );
                }
            ], callback );
        } else {
            callback( "Workspace for " + project.getRepo() + "/" + project.getRef() + " has not been created" );
        }
    });
}

function getFirstExistingDir( candidates, callback ) {
    console.log( "getFirstExistingDir" );
    var dir = candidates.shift();
    path.exists( dir , function( exists ) {
        if ( exists ) {
            callback( null, dir );
        } else {
            if ( candidates.length ) {
                getFirstExistingDir( candidates, callback );
            } else {
                callback( "none found" );
            }
        }
    });
}

function getProjectSpecificDirSync( baseDir, project ) {
    if ( project ) {
        baseDir = path.join( baseDir, project );
    }
    return baseDir;
}

function getRepoBaseDirSync( project ) {
    return getProjectSpecificDirSync( repoBaseDir, project.getOwner() );
}

function getWorkspaceBaseDirSync( project ) {
    return getProjectSpecificDirSync( workBaseDir, project.getOwner() );
}

function getRepoDir( project, callback ) {
    var repoDir = path.join( getRepoBaseDirSync( project ), project.getRepo() );
    getFirstExistingDir( [ repoDir, repoDir + ".git" ], callback );
}

function getWorkspaceDirSync( project ) {
    var workspaceDir;
    if ( project.getOwner() ) {
        workspaceDir = path.join( project.getWorkspaceBaseDirSync(), project.getRef(), project.getRepo() )
    } else {
        path.join(project.getRepo(), project.getRef() )
    }

    return workspaceDir;
}

function getCompiledDirSync( project ) {
    return path.join( getWorkspaceDirSync( project ), "__compiled" );
}

var Project = module.exports.Project = function ( owner, repo, ref ) {
    this.owner = owner;
    this.repo = repo;
    this.ref = ref || "master";
};

Project.prototype.getOwner = function() {
    return this.owner;
}

Project.prototype.getRepo = function() {
    return this.repo;
}

Project.prototype.getRef = function() {
    return this.ref;
}

Project.prototype.checkout = function( force, callback ) {
    return checkout( this, force, callback );
}

Project.prototype.cleanup = function( callback ) {
    return cleanup( this, callback );
}

Project.prototype.getRepoDir = function( callback ) {
    return getRepoDir( this, callback );
}

Project.prototype.getCompiledDirSync = function() {
    return getCompiledDirSync( this );
}

Project.prototype.getWorkspaceBaseDirSync = function() {
    return getWorkspaceBaseDirSync( this );
}

Project.prototype.getWorkspaceDirSync = function() {
    return getWorkspaceDirSync( this );
}

Project.prototype.fetch = function( callback ) {
    async.waterfall([
        _.bind( this.getRepoDir, this ),
        fetch
    ], callback );
}

module.exports.fetch = fetch;