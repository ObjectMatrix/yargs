const isPromise = require('./is-promise')

module.exports.globalMiddlewareFactory = function (globalMiddleware, context) {
  return function (callback, applyBeforeValidation = false) {
    if (Array.isArray(callback)) {
      for (let i = 0; i < callback.length; i++) {
        callback[i].applyBeforeValidation = applyBeforeValidation
      }
      Array.prototype.push.apply(globalMiddleware, callback)
    } else if (typeof callback === 'function') {
      callback.applyBeforeValidation = applyBeforeValidation
      globalMiddleware.push(callback)
    }
    return context
  }
}

module.exports.commandMiddlewareFactory = function (commandMiddleware) {
  if (!commandMiddleware) return []
  const middlewareError = new Error('middleware must be a function or a function/boolean pair')
  return commandMiddleware.map(middleware => {
    if (Array.isArray(middleware)) {
      if (middleware.length !== 2) {
        throw middlewareError
      } else if (typeof middleware[0] !== 'function' ||
        typeof middleware[1] !== 'boolean') {
        throw middlewareError
      }
      middleware[0].applyBeforeValidation = middleware[1]
      return middleware[0]
    } else if (typeof middleware === 'function') {
      middleware.applyBeforeValidation = false
      return middleware
    }
  })
}

module.exports.applyMiddleware = function (argv, yargs, middlewares, beforeValidation) {
  const beforeValidationError = new Error('middleware cannot return a promise when applyBeforeValidation is true')
  return middlewares
    .reduce((accumulation, middleware) => {
      if (middleware.applyBeforeValidation !== beforeValidation &&
          !isPromise(accumulation)) {
        return accumulation
      }

      if (isPromise(accumulation)) {
        return accumulation
          .then(initialObj =>
            Promise.all([initialObj, middleware(initialObj, yargs)])
          )
          .then(([initialObj, middlewareObj]) =>
            Object.assign(initialObj, middlewareObj)
          )
      } else {
        const result = middleware(argv)
        if (beforeValidation && isPromise(result)) throw beforeValidationError

        return isPromise(result)
          ? result.then(middlewareObj => Object.assign(accumulation, middlewareObj))
          : Object.assign(accumulation, result)
      }
    }, argv)
}
