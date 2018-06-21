import {authenticate} from 'passport';

export default function passportLoginMiddleware(req: any, res: any, next: (err: any) => any) {
  const username = req.body.email;
  const password = req.body.password;
  const authFunction = authenticate('local', {session: false});
  debugger;
  authFunction(req, res, (err: any) => {
    if (err) {
      // second authentication -> ldap
      const result = ldapLogin(username, password);

      if (result == null) {
        res.status(401).json(err); // set status and json body, does not get set automatically
        return next(err); // pass error to further error handling functions
      }
    }
    return next(null);
  });
}


function ldapLogin(username: string, password: string) {
  let client;

  try {
    // load libs
    const ldap = require('ldapjs');

    // get server settings and build search string
    const OPTS = buildOpts();
    const dn = buildDn(username);
    client = ldap.createClient(OPTS);

    // first authenticate then search
    if (isLdapAuthenticated(client, dn, password){
      ldapSearch(client, dn);
    }
  } catch (ex) {
    console.log(ex);
  } finally {
    // force unind if exists
    if (client != null) {
      client.unbind();
    }
  }

}

function buildOpts() {
  const OPTS = {
    url: 'ldap://ldap-rr.fbi.h-da.de:389',
    connectTimeout: 10000
  };
  return OPTS;
}

function buildDn(username: string) {
  const adSuffix = 'ou=people,ou=Students,dc=fbi,dc=h-da,dc=de';
  const dn = 'uid=' + username + ',' + adSuffix;
  return dn;
}


function ldapSearch(client: any, dn: string) {
  client.search(dn, (err: any, res: any) => {

    res.on('searchEntry', function (entry: any) {
      return entry.object;
    });
    res.on('searchReference', function (referral: any) {
      console.log('referral: ' + referral.uris.join());
    });
    res.on('error', function (error: any) {
      console.error('error: ' + error.message);
    });
    res.on('end', function (result: any) {
      console.log(result);
    });
  });
}

function isLdapAuthenticated(client: any, dn: string, password: string) {
  client.bind(dn, password, function (err: object) {
    if (err == null) {
      return true;
    } else {
      return false;
    }
  });
  client.unbind();
}
