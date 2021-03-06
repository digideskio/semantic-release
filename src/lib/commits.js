var exec = require('child_process').exec

var log = require('npmlog')

var SemanticReleaseError = require('@semantic-release/error')

module.exports = function (config, cb) {
  var lastRelease = config.lastRelease
  var options = config.options
  var branch = options.branch
  var from = lastRelease.gitHead
  var range = (from ? from + '..' : '') + 'HEAD'

  if (!from) return extract()

  exec('git branch --contains ' + from, function (err, stdout) {
    var inHistory = false
    var branches

    if (!err && stdout) {
      branches = stdout.split('\n')
      .map(function (result) {
        if (branch === result.replace('*', '').trim()) {
          inHistory = true
          return null
        }
        return result.trim()
      })
      .filter(function (branch) {
        return !!branch
      })
    }

    if (!inHistory) {
      log.error('commits',
        'The commit the last release of this package was derived from is not in the direct history of the "' + branch + '" branch.\n' +
        'This means semantic-release can not extract the commits between now and then.\n' +
        'This is usually caused by force pushing, releasing from an unrelated branch, or using an already existing package name.\n' +
        'You can recover from this error by publishing manually or restoring the commit "' + from + '".' + (branches && branches.length
        ? '\nHere is a list of branches that still contain the commit in question: \n * ' + branches.join('\n * ')
        : ''
      ))
      return cb(new SemanticReleaseError('Commit not in history', 'ENOTINHISTORY'))
    }

    extract()
  })

  function extract () {
    exec(
      'git log -E --format=%H==SPLIT==%B==END== ' + range,
      {
        maxBuffer: 1024 * 1024 // 1MB instead of 220KB (issue #286)
      },
      function (err, stdout) {
        if (err) return cb(err)

        cb(null, String(stdout).split('==END==\n')

        .filter(function (raw) {
          return !!raw.trim()
        })

        .map(function (raw) {
          var data = raw.split('==SPLIT==')
          return {
            hash: data[0],
            message: data[1]
          }
        }))
      }
    )
  }
}
