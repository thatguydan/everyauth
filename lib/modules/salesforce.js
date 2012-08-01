var oauthModule = require('./oauth2')
  , request = require('request')

  , url = require('url');

var salesforce = module.exports =
oauthModule.submodule('salesforce')
  .configurable({
      appInstanceName: 'the instance for your organization'
    , immediate: 'determines whether the user should be prompted for login and approval. Values are either true or false (default).'
    , display: 'specify type of auth dialog: page (default), popup, touch or mobile'
  })
  .authPath('/services/oauth2/authorize')
  .accessTokenPath('/services/oauth2/token')
  .entryPath('/auth/salesforce')
  .callbackPath('/auth/salesforce/callback')
  .authQueryParam('response_type', 'code')
  .accessTokenHttpMethod('post')
  .postAccessTokenParamsVia('data')
  .accessTokenParam('grant_type', 'authorization_code')
  .accessTokenParam('format', 'json')

  .authCallbackDidErr( function (req) {
    var parsedUrl = url.parse(req.url, true);
    return parsedUrl.query && !!parsedUrl.query.error;
  })
  .handleAuthCallbackError( function (req, res) {
    var parsedUrl = url.parse(req.url, true)
      , errorDesc = parsedUrl.query.error_description;
    if (res.render) {
      res.render(__dirname + '/../views/auth-fail.jade', {
        errorDescription: errorDesc
      });
    } else {
      // TODO Replace this with a nice fallback
      throw new Error("You must configure handleAuthCallbackError if you are not using express");
    }
  })

  .moduleErrback( function (err, seqValues) {
    if (err instanceof Error) {
      var next = seqValues.next;
      return next(err);
    } else if (err.extra) {
      var salesforceResponse = err.extra.res
        , serverResponse = seqValues.res;
      serverResponse.writeHead(
          salesforceResponse.statusCode
        , salesforceResponse.headers);
      serverResponse.end(err.extra.data);
    } else if (err.statusCode) {
      var serverResponse = seqValues.res;
      serverResponse.writeHead(err.statusCode);
      serverResponse.end(err.data);
    } else {
      console.error(err);
      throw new Error('Unsupported error type');
    }
  })


  .addToSession( function (sess, auth) {
    this._super(sess, auth);
    if (auth.refresh_token) {
      sess.auth[this.name].refreshToken = auth.refresh_token;
    }
    sess.auth[this.name].instance_url = auth.instance_url;
  })

  .fetchOAuthUser(function (accessToken, other) {
    var promise = this.Promise();
    var opts = {
        url: other.extra.instance_url + '/services/data/v25.0/chatter/users/me'
      , headers: {
          'Authorization':'Bearer '+accessToken
        }
    };
    request.get(opts, function (err, res, body) {
      console.log(body);
      if (err) return promise.fail(err);
      if (parseInt(res.statusCode / 100, 10) !== 2) {
        return promise.fail(body);
      }
      return promise.fulfill(JSON.parse(body));
    });
    return promise;
  });

salesforce.appInstanceName = function(instanceName) {
  this.apiHost('https://'+instanceName);
  this.oauthHost('https://'+instanceName);
  return this;
}  
salesforce.immediate = function(isImmediate) {
  if (typeof isImmediate=="boolean") {
    this.authQueryParam('immediate', isImmediate);
  }
  return this;
};
salesforce.display = function(displayType) {
  if (displayType) {
    this.authQueryParam('display', displayType);
  }
  return this;
}