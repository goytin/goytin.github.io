/*============================================================================
GitHub Pages Authentication (GHP-Auth or GHPA)

For details on GHPA see:

 - GHPA GitHub repository: https://github.com/scheidelg/ghpa
 
 - Corresponding GHPA website, published through GitHub Pages:
   https://scheidelg.github.io/ghpa or https://ghpa.scheidel.net
   
 - GHPA GitHub repository - README.md:
   https://github.com/scheidelg/ghpa/blob/master/README.md>README.md

The GHPA JavaScript and example HTML contain a large amount of comments and
are formatted for readability.  You may want to use the 'minified' version of
GHPA.
----------------------------------------------------------------------------
Copyright (c) Greg Scheidel.

GHPA is licensed under the GNU General Public License v3.0.
----------------------------------------------------------------------------*/


/*============================================================================
function ghpaAuthMessage(authMessage)
------------------------------------------------------------------------------
Display a message to the user.  First try to display a message by setting the
HTML of an element with id of 'ghpaAuthMessage' on the current web page;
append the current date/time to the message.  If no such element exists or
that element is hidden, then use a pop-up; don't append the current date/time.

------------------------------------------------------------------------------
Arguments

authMessage                         string

    The message to display.

------------------------------------------------------------------------------
Variables

authMessageElement                  object

    Reference to the web page element with id of 'ghpaAuthMessage'.

------------------------------------------------------------------------------
Return Value: none
----------------------------------------------------------------------------*/
function ghpaAuthMessage(authMessage) {
    /* Get a reference to the web page element with id of 'ghpaAuthMessage'.
     * If the element exists and isn't hidden, then set the HTML of that
     * element. */
    if ((authMessageElement = document.getElementById('ghpaAuthMessage')) && authMessageElement.style.display != 'none') {
        authMessageElement.innerHTML = htmlEncode(authMessage) + '<small> [' + (new Date().localBigEndianFull()) + ']</small>';

    /* Otherwise, use a popup. */
    } else {
        window.alert(authMessage);
    }
}


/*============================================================================
function ghpaClearSSO
------------------------------------------------------------------------------
Clear the authentication token from memory so that subsequent attempts to
access the private GitHub repository require re-authentication.
------------------------------------------------------------------------------
Arguments: none
------------------------------------------------------------------------------
Return value: none
----------------------------------------------------------------------------*/
function ghpaClearSSO() {
    sessionStorage.removeItem('ghpaUserID');
    sessionStorage.removeItem('ghpaCreds');
    sessionStorage.removeItem('ghpaCredsKey');

//TO DO!!!! check whether items are cleared, and return false if we can't confirm <--------!!!!!!!!!!!!!!!!!
 //   ghpaAuthMessage('Cleared SSO authentication credentials.');
    return (true);
}


/*============================================================================
async function ghpaLoadPage
------------------------------------------------------------------------------
Attempt to retrieve authentication credentials from memory and - if SSO is
enabled - use them to retrieve content from the private GitHub repository.

If:

 - SSO is enabled,
  - authentication credentials can be retrieved from memory, and
  - the private GitHub repository file can be retrieved

then the page content is replaced with the retrieved content.

Otherwise, the login form is loaded and (if there was a failed attempt to load
content) a status message displayed.
   
This function needs to be called within the <body> of the calling web page;
otherwise it will generate an error when it tries to modify elements within
the <body> that haven't yet been loaded.  The recommended method is to use
the 'onload' method.  For example:

    <body onload='ghpaLoadPage()'>

Another option is to run the script within - preferably at the bottom of - the
<body>.  For example:

    <body>
        HTML goes here.
        
        <!-- ideally this should be at the bottom of the <body> -->
        <script>ghpaLoadPage();</script>
    </body>

Declared as an async function because we're retrieving content using fetch()
and then acting on that content; and need to wait until all of that is done
before returning from this function.
------------------------------------------------------------------------------
Arguments: none

------------------------------------------------------------------------------
Return value: none

------------------------------------------------------------------------------
Variables

retrievedCreds                      string

    Credentials, if any, retrieved from sessionStorage.  If present, pass to
    ghpaRetrieve() to attempt initial authentication to GitHub (instead of the
    call to ghpaRetrieve() from the form inside the element ghpaLoginForm,
    which retrieves credentials from the form element).

    See ghpaRetrieve() comments for details.

retrievedCredsKey                   string

    An optional string argument containing an encoded representation of an
    AES-256 encryption key and initialization vector (IV); which can be used
    to decrypt the 'creds' argument contents.

    See ghpaRetrieve() comments for details.
----------------------------------------------------------------------------*/
async function ghpaLoadPage() {

    /* Attempt to retrieve GitHub authentication credentials from
     * sessionStorage.  This is either a JSON.stringify string of a JSON
     * object; or that string after being AES-256 encrypted and then
     * base-64 encoded. */
    const retrievedCreds = sessionStorage.getItem('ghpaCreds');

    /* Attempt to retrieve encryption key for GitHub authentication
     * credentials from sessionStorage. */
    const retrievedCredsKey = sessionStorage.getItem('ghpaCredsKey');
 
    /* If SSO is enabled and we have existing authentication credentials to
     * use, then attempt to retrieve content from the private GitHub
     * repository. */
    if (!(ghpaSSOFlag && retrievedCreds && ghpaRetrieve(true, retrievedCreds, retrievedCredsKey))) {
        /* If any of:
         *  - SSO isn't enabled;
         *
         *  - we don't have existing authentication credentials to use; or
         *
         *  - SSO was enabled and we do have existing authentication
         *    credentials, but we weren't able to retrieve content from the
         *    private GitHub repository
         *
         * then make sure the element ghpaPrompt  is displayed and load the
         * login form. */

        /* Enable display of the element ghpaPrompt.  In JavaScript, we can
         * set an elements 'style.display' property back to it's default by
         * setting it to a null string. */
        document.getElementById('ghpaPrompt').style.display = '';

        /* If ghpaLoginFormFile is set to '-', then don't replace the element
         * ghpaLoginForm. */
        if (ghpaLoginFormFile != '-') {
            /* Retrieve the login form. */
            await fetch(ghpaLoginFormFile)

            .then(function (response) {

                /* A response from the website indicating a failure to
                 * retrieve the page is still a valid response that fulfills
                 * the fetch() promise; check the HTTP response code and throw
                 * an error on anything except a 200 HTTP response. */
                if (response.status != 200) {
                    throw new Error(`${response.status} HTTP response`);
                }

                /* Provide response.text for processing by the next action in
                 * the chain. */
                return response.text();
            })

            /* Process the retrieved HTML code. */
            .then(function (HTMLcode) {
                document.getElementById('ghpaLoginForm').innerHTML = HTMLcode;
            })

            /* On an error, display an error message and then write an error
             * to the console. */
            .catch(function(errObject) {
                ghpaAuthMesssage('ghpaLoadPage() error attempting to load login form: ' + errObject.message);
                console.error(errObject);
            });
        }
    }
}


/*============================================================================
async function ghpaRetrieve(retrievedCredsFlag, creds, credsKey)
------------------------------------------------------------------------------
Attempt to authenticate to and retrieve content from the private GitHub
repository.

If authentication is successful and ghpaSSOFlag is true, then save credentials
in memory for later use.

If content can be retrieved and ghpaAuthOnlyFlag is false, then update the
content on the calling web page.

If there are any errors, update HTML on the calling web page to display the
error message.

This function is called either from ghpaLoadPage() or directly from a web page
For the latter case, the most common use would be to call as part of the
submit action on a form.  For example:

    <form onsubmit="event.preventDefault(); ghpaRetrieve(false, this);">

Declared as an async function because we're retrieving content using fetch()
and then acting on that content; and need to wait until all of that is done
before returning from this function.
------------------------------------------------------------------------------
Arguments

creds                               (type varies; see below)

    Credentials can be passed in one of three forms:
    
     1. As a form element when a form submits using:

            <form onsubmit="event.preventDefault(); ghpaRetrieve(false, this);">

        In this case the form must have two input fields:

         a. An id of 'ghpaLogin' to hold the user's login name.

         b. An  id of 'ghpaPassword' to hold the user's password.

        This is the method used when first accessing content from the private
        repository, and authentication credentials have not yet been saved in
        sessionStorage.

     2. A  GitHUB authentication token (string).  The token is formed by
        concatenating the username and password (or personal access token
        string) with a ':' character, and then base64-encoding the string.
        For example:
     
            GitHubToken = btoa(`${login}:${password}`);

        where 'login' and 'password' are variables identifying the user ID
        and password (or personal access token string) to use for GitHub
        authentication.


        This is the method used when the user has already authenticated to
        GitHub, the ghpaSSOFlag option is set, credentials were not able to be
        encrypted with AES-256 (see the next method, below), and the
        credentials have been stored in sessionStorage for later use.

     3. As a string created using the above method, but then encrypted with
        AES-256 and encoded.

        This string is also retrieved from sessionStorage in ghpaLoad(), and
        saved to sessionStorage in ghpaRetrieve().

        Encoding is done using the cipherBuffer Uint8Array and the same
        method as described for the 'credsKey' variable.

        This is the method used when the user has already authenticated to
        GitHub, the ghpaSSOFlag option is set, credentials *are* able to be
        encrypted with AES-256 (see the next method, below), and the
        credentials have been stored in sessionStorage for later use.
        
        This is preferred over method #2 and will automatically be attemped.

        Note that the *ONLY* benefit of the AES encryption is so that casual
        browsing of the sessionStorage space doesn't reveal the plaintext or
        base64-encoded representation of the GitHub user ID and password (or
        personal access token string).  This does *NOT* protect the
        authentication credentials from someone who also retrieves the AES key
        and IV from memory, and decrypts the authentication credentials.

credsKey                            string; optional

    An optional string argument containing an encoded representation of an
    AES-256 encryption key and initialization vector (IV); which can be used
    to decrypt the 'creds' argument contents.  Retrieved from and saved to
    sessionStorage.

    When the key is exported as raw data, it's represented as a 32-byte
    Uint8Array.  The IV is reprsented as a 12-byte UintArray.  Encoding to
    save in sessionStorage is simply a concatenation of the hexadecimal
    representation of each element in both arrays.  For example, if the arrays
    had elements:

        AESkeyB[0]=190   AESkeyB[8]=57     AESkeyB[16]=212   AESkeyB[24]=91
        AESkeyB[1]=184   AESkeyB[9]=116    AESkeyB[17]=169   AESkeyB[25]=202
        AESkeyB[2]=133   AESkeyB[10]=2     AESkeyB[18]=37    AESkeyB[26]=26
        AESkeyB[3]=240   AESkeyB[11]=53    AESkeyB[19]=20    AESkeyB[27]=209
        AESkeyB[4]=102   AESkeyB[12]=138   AESkeyB[20]=214   AESkeyB[28]=229
        AESkeyB[5]=40    AESkeyB[13]=7     AESkeyB[21]=36    AESkeyB[29]=254
        AESkeyB[6]=131   AESkeyB[14]=9     AESkeyB[22]=208   AESkeyB[30]=19
        AESkeyB[7]=251   AESkeyB[15]=205   AESkeyB[23]=233   AESkeyB[31]=88

        AESiv[0]=116     AESiv[3]=17       AESiv[6]=123      AESiv[9]=144
        AESiv[1]=239     AESiv[4]=240      AESiv[7]=46       AESiv[10]=29
        AESiv[2]=61      AESiv[5]=14       AESiv[8]=16       AESiv[11]=104

    Then the encoded string would be:

        beb885f0662883fb397402358a0709cdd4a92514d624d0e95bca1ad1e5fe135874ef3d11f00e7b2e10901d68

retrievedCredsFlag                  boolean

    Identifies whether this call is being made after retrieving SSO
    credentials from sessionStorage, vs. from a form where the username and
    password (or personal access token) have been entered.

    True:  SSO credentials are passwed in the creds and credsKey arguments
    False: SSO credentials are not available; the creds argument contains a
           reference to a form element

------------------------------------------------------------------------------
Variables

AESkey                              CryptoKey

    Key to use for the AES encryption/decription of the GitHub token.

    See: https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey

AESiv                               Uint8Array[12]

    Initialization vector (IV) used for the AES encryption/decryption of the
    GitHub token.

AESkeyBuffer                        Uint8Array[32]

    Array to hold the binary representation of the exported AES key.  Used
    when exporting the key before saving in sessionStorage; and when reading
    data from sessionStorage so that the key can be imported. 

cipherBUffer                        Uint8Array[variable length]

    Array to hold the binary representation of the encrypted GitHub token.

fetchResponse                       integer

    Holds the response of the HTTPS query to retrieve content from GitHub.
    The only reason we need this is so that we have a variable scoped to the
    overall function, and so can set the variable and use it to determine the
    return value from the overall function.

GitHubToken                         string

    The base64-encoded authentication token to pass to GitHub.  The unencoded
    text is formatted as:

        login_name:password_or_PAT_string

    where 'login_name' and 'password_or_PAT_string' are replaced by actual
    values to use for authentication.

login                               string

    Hold the login name so that it can be displayed in status/error messages.

tokenDelimiterPosition              string

    The character position of the ':' delimiter in the base64-decoded GitHub
    authentication token.

------------------------------------------------------------------------------
Return Value

We're generally calling this function from one of two places:

 (a) On submission of an HTML form where we've prevented the default form
     action from firing.

     In this case it doesn't really matter what we return from this
     function... but we should return *something.*

 (b) From ghpaLoadPage.js when both SSO is enabled and authentication
     credentials are in sessionStorage.

     In this case we want to return true/false to identify whether content was
     successfully loaded.  That way the loading script code can determine
     whether any additional action needs to be taken such as displaying a
     prompt and/or an error message, or presenting the login form.

true:  received an HTML response code of 200 when retrieving the content
       from the private GitHub repository

false: did *not* receive an HTML response code of 200
----------------------------------------------------------------------------*/
async function ghpaRetrieve(retrievedCredsFlag, creds, credsKey) {

    let GitHubToken;
    let login;
    let tokenDelimiterPosition;

    let fetchResponse=0; // set an initial value of 'no response'

    /* If we retrieved a token from sessionStorage, then prepare it for
     * use in authenticating to GitHub. */
    if (retrievedCredsFlag && creds) {
        
        /* If we retrieved a string representation of the AES-256 key and IV
         * from sessionStorage then convert them to a usable key and IV and
         * decrypt the GitHub token. */
        if (credsKey) {

            /* Create a new Uint8Array to hold the AES-256 binary data. */
            let AESkeyBuffer = new Uint8Array(32);

            /* Convert the retrieved key data back to binary.
             *
             * Characters 1 through 64 (of the data retrieved from
             * sessionStorage) is a hexadecimal character representation of
             * the AES-256 key's binary data. */
            for (let index = 0, arrayLength = AESkeyBuffer.length; index < arrayLength; index++) {
                AESkeyBuffer[index]=parseInt(credsKey.slice(index*2, (index*2)+2), 16);
            }
            
            /* Create a new Uint8Array to hold the IV as binary data. */
            let AESiv = new Uint8Array(12);

            /* Convert the retrieved IV data back to binary.
             *
             * Characters 65 through 88 (of the data retrieved from
             * sessionStorage) is a hexadecimal character representation of
             * the AES-256 IV's binary data. */
            for (let index = 0, arrayLength = AESiv.length; index < arrayLength; index++) {
                AESiv[index]=parseInt(credsKey.slice((index*2)+64, (index*2)+66), 16);
            }

            /* Import the retrieved key data into a usable encryption key
             * object. */
            await window.crypto.subtle.importKey("raw", AESkeyBuffer, "AES-GCM", true, ["encrypt", "decrypt"])
            .then(async function(AESkey) {

                /* Create a new Uint8Array to hold the encrypted token as binary
                 * data.
                 *
                 * The encrypted token is saved as hexadecimal characters, where
                 * every two characters represents a byte.  So, the number of
                 * elements in the array = ((# of characters) / 2). */
                let cipherBuffer = new Uint8Array(creds.length/2);

                /* Convert the retrieved encrypted token back to binary. */
                for (let index = 0, arrayLength = cipherBuffer.length; index < arrayLength; index++) {
                    cipherBuffer[index]=parseInt(creds.slice((index*2), (index*2)+2), 16);
                }

                /* Decrypt the GitHub token. */
                creds = new TextDecoder().decode(await window.crypto.subtle.decrypt({name: "AES-GCM", iv: AESiv}, AESkey, cipherBuffer));
            })
            .catch(function(errObject) {
                window.alert('ghpaRetrieve() error attempting to decrypt GitHub token: ' + errObject.message);
                console.error(errObject);
            });
        }

        /* Extract the username so that we can use it in messages, and save
         * the GitHub token in a separate variable for later reference.  Also
         * perform some basic validation that the retrieved token is valid.
         *
         * Yes, we're calling atob() twice when instead we could be saving the
         * results in a variable and referencing the variable.   This
         * minimizes the instances of the unencoded password in memory.  Yes,
         * it's an extremely marginal benefit (the user ID and password are
         * already in memory as base64-encoded) text. */
        tokenDelimiterPosition=atob(creds).search(":");
        if (tokenDelimiterPosition == -1) {
            /* A GitHub token is supposed to be 'user:password'.  If we don't
             * have a ':' character then something isn't right. */
            GitHubToken = '';
            login = '';
        } else {
            login = atob(creds).slice(0, tokenDelimiterPosition);

            /* Save the retrieved token in a new variable name. */
            GitHubToken = creds;
        }

    /* If we were passed credentials from a form, then extract the username
     * and password (or personal access token string) and create the GitHub
     * token. */
    } else {
        /* Save the login name for error messages.
         *
         * Don't save the password anywhere except in the base64-encoded
         * GitHub token (yes, it's already exposed in the form and we're going
         * to put a base64-encoded version in a variable; still, minimize
         * exposure whereever it's reasonable). */
        login = creds.querySelector('#ghpaLogin').value;

        /* Save the position of the ':' character in the base64-decoded
         * GitHub authentication token, just to make some of the other code
         * slightly simpler. */
        tokenDelimiterPosition = login.length;

        /* We're saving the token in a new variable name instead of re-using
         * the variable for the argument passed to this function; because we
         * might want to reference this specific login form later in this
         * function. */
        //GitHubToken = btoa(`${login}:` + creds.querySelector('#ghpaPassword').value);
	
	// TODO: Add explnation.
	GitHubToken = creds.querySelector('#ghpaPassword').value;
    }

    /* At this point we should have the login and GitHubToken.  Validate that
     * everything looks OK with that data.  If not, kick out some error
     * messages.  If so, then attempt to authenticate to GitHub. */

    /* If we were passed retrieved credentials but weren't able to extract
     * a login name, then something is wrong. */
    if (retrievedCredsFlag && (! login)) {
        ghpaAuthMessage("SSO GitHub token couldn't be parsed. Try logging out and logging in again.");

    /* If the login name extracted from the GitHub token doesn't match the
     * name already saved in ghpaUserID, then something is wrong. */
    } else if (retrievedCredsFlag && (login != ghpaUserID)) {
        ghpaAuthMessage("Currently logged in user ID and user ID from SSO GitHub token don't match. Try logging out and logging in again.");

    /* According to github.com/join, GitHub usernames:
     *
     *  - can contain alpahnumeric characters or single hyphens
     *  - cannot begin or end with a hyphen
     *
     * We also don't want to accept empty user names, so reject those as well.
     * The username and password fields on the login form should be marked as
     * 'required' but users are crazy.  This will also serve as a (minor)
     * check against a problem with data retrieved from sessionStorage. */
    } else if (! login.match(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d]))+$/i)) {

        /* Don't display the bogus user name as part of an error message.  Part
         * of the point of this filter is to prevent XSS by only allowing valid
         * characters; it would be self-defeating to then display the invalid
         * characters to the user in an error message. */
        ghpaAuthMessage("GitHub usernames may only contain alphanumeric charcters or single hypens, cannot begin or end with a hyphen, and must not be empty.");

    /* If ghpaTokensOnlyFlag is enabled, require passwords that match the
     * format of a GitHub personal access token string: 40 hexadecimal
     * characters. */
    } else if (0 /*ghpaTokensOnlyFlag && ! atob(GitHubToken).slice(tokenDelimiterPosition + 1).match(/^[a-f0-9]{40}$/i)*/) {

        /* Display an error message on the web page. */
        ghpaAuthMessage("Use of GitHub personal access tokens is required for authentication, and the passcode entered doesn't appear to be a token string.");

    } else {

        /* The ghpaFilename variable is initially defined in the JavaScript
         * header, and set to an emptry string.  The calling page can
         * optionally specify the private page to load by setting the value of
         * the variable.
         *
         * If the variable is set to an empty string then retrieve the
         * pathname of the URL for the current window
         * (window.location.pathname).  Note that this is always an absolute
         * path but may specify a directory name instead of a specific
         * file. */
        if (! ghpaFilename) {
            ghpaFilename = window.location.pathname;

        /* If the filename isn't set to an empty string but isn't an absolute
         * path (i.e., it doesn't start with a '/' character), then combine it
         * with window.location.pathname. */
        } else if (ghpaFilename.slice(0, 1) != '/') {
            /* Prepend the filename with the directory portion of
             * window.location.pathname.  For example, if 
             * window.location.pathname is '/dir/subdir/file1' and the existing
             * existing filename is 'file2', then we want to end up with
             * '/dir/subdir/file1'.
             *
             * In other words, we're assuming that a non-absolute filename is
             * intended to be relative to the current directory.
             *
             * We can do this by stripping window.location.pathanm of anything
             * after the right-most '/' character, then appending the
             * filename. */
            ghpaFilename = window.location.pathname.replace(/\/[^\/]*$/, '/') + ghpaFilename;
        }

        /* If the filename references a directory (i.e, ends with a '/'
         * character), then append the default HTML file name that was set in
         * the ghpaDefaultHTMLfile variable (usually via the ghpaConfig.js
         * file).  */
        if (ghpaFilename.slice(ghpaFilename.length - 1) == '/') {
            ghpaFilename = ghpaFilename + ghpaDefaultHTMLfile;
        }

        /* We now we have an absolute filename that specifies the file to
         * retrieve but that filename might contain some oddities, since we've
         * effectively allowed user input through the use of the ghpaFilename
         * and ghpaDefaultHTMLfile variables.
         *
         * Just a few of the variations that we might have at this point:
         *
         *     /dir/subdir/./file1
         *     /dir/subdir/../file1
         *     /dir/subdir/..//.//../file1
         *     /dir/subdir/.//file
         *     /sub dir/file
         *     /subdir/ file
         *
         * First we should encode 'special' URI characters.  We can do this
         * with the encodeURI() function.
         *
         * Then we should normalize the path.  We can normalize by iteratively
         * replacing:
         *
         *      Text         RegEx                              Replace With
         *      -----        -----                              -----
         *      //           \/\/                               /
         *      /./          \/\.\/                             /
         *      /xxx/../     \/[^\/]+(?<!(\.)|(\.\.))\/\.\.\/   /
         *         where 'xxx' is not '.' or '..'
         */

        /* Encode any 'special' URI characters. */
        ghpaFilename = encodeURI(ghpaFilename);

        /* Normalize the path.
         *
         * We're using a variable to hold the regular expression object to
         * minimize the odds of a typo in the initial search() and subsequent
         * replace().  Aside from generally unpredictable results, a mismatch
         * could cause an infinite loop.
         *
         * Note that this relies on a negative look-behind assertion.  If we
         * need to support a browser that doesn't support negative look-behind
         * assertions (low odds at this point) then we'd need to replace this
         * with a function that splits the string at '/' characters, then
         * spins through the resulting array to remove '' and '.' elements,
         * and remove any '..' element along with it's preceding element. */
        let myRegExp = /(\/\/)|(\/\.\/)|(\/[^\/]+(?<!(\.)|(\.\.))\/\.\.\/)/g;
        while (ghpaFilename.search(myRegExp) != -1) {
            ghpaFilename = ghpaFilename.replace(myRegExp, '/');
        }

        /* Craft the GitHub GET request to retrieve the specified file.
         *
         * Note that the GitHub GET request URI includes '/contents/' with a
         * trailing '/' character followed by the filename to retrieve; but
         * that our code below doesn't include the trailing '/' character.
         * That's because at this point ghpaFilename is guaranteed to have a
         * leading '/' character - so it's all good. */

	/* GitHub uses Authorization: Bearer
	 * see https://docs.github.com/en/rest/guides/getting-started-with-the-rest-api#using-query-parameters
	 * Vladik, 2022.09.06
	 */
        const request = new Request(
            `https://api.github.com/repos/${ghpaOrg}/${ghpaRepo}/contents${ghpaFilename}?ref=${ghpaBranch}`,
            {
                method: 'GET',
                credentials: 'omit',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${GitHubToken}`
                },
            }
        );

        /* Send the GitHub GET request and process the results; wait for this to
         * finish before continuing. */
        await fetch(request).then(async function (response) {
            /* If we received a response code that indicates successful
             * authentication, and we're using SSO, then store GitHub
             * authentication token for later use.
             *
             * The only reason we're doing this is so that we can save the key
             * for use when another web page (during this session) attempts to
             * retrieve and reuse the GitHub credentails. */             
            if (ghpaSSOFlag && (response.status == 200 || response.status == 404)) {

                /* The actions required to store the token for later use:
                 *
                 *  - generate a new AES-256 key
                 *  - generate an initialization vector (IV)
                 *  - export the AES key so that we can easily save it as
                 *    persistent data
                 *  - encrypt the GitHub token
                 *  - convert the AES key and IV to data that can be easily
                 *    saved in sessionStorage
                 *  - save the encrypted GitHub token in sessionStorage
                 *  - save the AES key and IV in sessionStorage
                 *
                 * Our first action is generating the AES key.  We execute
                 * with a Promise where the remainder of the actions only run
                 * if the AES key generation is successful; and error-trapping
                 * all of the steps with a 'catch'.
                 *
                 * So: Unless all of the prior required steps are successful,
                 * the encrypted token, AES key, and IV don't get saved to
                 * sessionStorage. */
                await window.crypto.subtle.generateKey({name: "AES-GCM", length: 256}, true, ["encrypt", "decrypt"])
                .then(async function(AESkey) {

                   /* Export the AES key and convert it to an array of 8-bit
                    * unsigned integers.  This isn't necessary for the
                    * encryption of the GitHub token; it's just facilitates
                    * saving the AES key in sessionStorage. */
                    const AESkeyBuffer = new Uint8Array(await window.crypto.subtle.exportKey("raw", AESkey));

                    /* Generate the IV; this variable is used directly in the
                     * encryption step and then converted to data we can
                     * readily save in sessionStorage. */
                    const AESiv = await window.crypto.getRandomValues(new Uint8Array(12));

                    /* Create a string of hexadecimal text representing the
                     * array values for the key and IV; this is what we'll
                     * save to sessionStorage. */
                    credsKey='';
                    for (let index = 0, arrayLength = AESkeyBuffer.length; index < arrayLength; index++) {
                        credsKey += AESkeyBuffer[index].toString(16).padStart(2, '0');
                    }
                    for (let index = 0, arrayLength = AESiv.length; index < arrayLength; index++) {
                        credsKey += AESiv[index].toString(16).padStart(2, '0');
                    }

                    /* Encode the GitHub token (using TextEncoder) into a
                     * Uint8Array; then encrypt that using the AES key and
                     * IV. */
                    const cipherText = await window.crypto.subtle.encrypt({name: "AES-GCM", iv: AESiv}, AESkey, new TextEncoder().encode(GitHubToken));

                    /* Convert the cipherText into a Uint8Array to work with. */
                    let cipherBuffer = new Uint8Array(cipherText);

                    /* Create a string of hexadecimal text representing the array
                     * values for the cipherText; this is what we'll save to
                     * sessionStorage. */
                    GitHubToken='';
                    for (let index = 0, arrayLength = cipherBuffer.length; index < arrayLength; index++) {
                        GitHubToken += cipherBuffer[index].toString(16).padStart(2, '0');
                    }

                    /* Save the text representation of the AES-256 key and IV to
                     * sessionStorage */
                    sessionStorage.setItem('ghpaCredsKey', credsKey);

                    /* Save the credentials to sessionStorage.  They will definitely
                     * be converted to a JSON.stringify output at this point, and
                     * should be encrypted and base64-encoded. */
                    sessionStorage.setItem('ghpaCreds', GitHubToken);

                    /* Save the currently logged in user ID to sessionStorage. */
                    sessionStorage.setItem('ghpaUserID', login);

                    /* sessionStorage.setItem() doesn't have a return value to
                     * tell us whether the action was successful.  So let's
                     * retrieve the data that we just set to see if all
                     * values were successfully saved.  And if they weren't,
                     * then clear all values; in cases where the GitHub token
                     * is encrypted, we need both the ciphertext and the
                     * decryption key/IV, and we want the saved user ID to be
                     * correct. */
                    if (sessionStorage.getItem('ghpaCreds')    != GitHubToken ||
                        sessionStorage.getItem('ghpaCredsKey') != credsKey ||
                        sessionStorage.getItem('ghpaUserID')   != login) {
                        
                        sessionStorage.removeItem('ghpaCreds');
                        sessionStorage.removeItem('ghpaCredsKey');
                        sessionStorage.removeItem('ghpaUserID');
                    }
                })
                .catch(function(errObject) {
                    window.alert('ghpaRetrieve() error attempting to encrypt GitHub token: ' + errObject.message);
                    console.error(errObject);
                });
            }

            /* If we're performing an authentication-only check and we were able
             * to authenticate, then display an appropriate message.
             *
             * Note that when performing an authentication-only check, a
             * response.status of 404 is really what we want, as it indicates
             * that authentication was successful but the specified file
             * ghpaFilename doesn't exist in the private repository.  If we get a
             * response.status of 200 then it means that the specified file does
             * exist in the private repository - which doesn't make sense for an
             * authentication-only check, since there's no reason to have a
             * corresponding file in the private repository.  If, on the other
             * hand, we have a static file in the private repository that we want
             * to display after a successful login, then just retrieve that
             * without setting ghpaAuthOnlyFlag. */
            if (ghpaAuthOnlyFlag && (response.status == 200 || response.status == 404)) {
                /* Display the 'success' message. */
                 ghpaAuthMessage(`Confirmed GitHub authentication as ${login}.` + (ghpaSSOFlag ? " Credentials saved for SSO." : ""));

                /* Hide the login form (if it's currently displayed).  Once
                 * the user successfully logs in, we don't want to confuse
                 * them by still presenting a login form. */
                document.getElementById('ghpaLoginForm').style.display = "none";

            /* If we successfully retrieved the contents and we are not
             * performing an authentication-only check, then display the
             * retrieved content. */
            } else if (response.status == 200 && ! ghpaAuthOnlyFlag) {        
                response.json().then(function (json) {
                    /* Retrieve the content. */
                    const contentRetrieved = json.encoding === 'base64' ? atob(json.content) : json.content;

                    /* Render just the content inside <body></body> tags from
                     * the retrieved content? */
                    if (ghpaOnlyGetBodyFlag) {

                        /* Find the first instance of '<body'.  Not looking
                         * for '<body>' because we have to allow for the
                         * possibility that there might be attributes in the
                         * tag. */
                        const startIndex = contentRetrieved.indexOf('<body');

                        /* Find the ending '>' to mark the start of content to
                         * render. */
                        const startRetrievalIndex = contentRetrieved.indexOf('>', startIndex) + 1;

                        /* Find the next closing '</body>' to mark the end of
                         * content to render. */
                        const endIndex = contentRetrieved.indexOf('</body>', startRetrievalIndex);
  
                        /* If either startIndex or endIndex are -1, then we
                         * didn't find the markers.  Replace webpage content
                         * with a null string. */
                        if (startIndex == -1 || endIndex == -1) {
                            document.body.innerHTML = '';

                        /* If we found the markers, then render the marked
                         * content. */
                        } else {
                            document.body.innerHTML = contentRetrieved.slice(startRetrievalIndex, endIndex);
                        }

                    /* Render all the retrieved content? */
                    } else {
                        document.body.innerHTML = contentRetrieved;
                    }
                });

            /* If we didn't successfully retrieve the content, then display an
             * appropriate error message. */
            } else if (response.status != 200) {
                
                /* If this is an authentication-only check and the response code
                 * was *not* 404 (file not found), then display an error message
                 * specific to 'authentication failed. */
                if (ghpaAuthOnlyFlag && response.status != 404) {
                    ghpaAuthMessage(`Failed to authenticate to ${ghpaOrg} : ${ghpaRepo} : ${ghpaBranch} as ${login} (status: ${response.status}).`);

                /* If this was an attempt to actually retrieve content (i.e., not
                 * an authentication-only check), then display a generic error
                 * message.
                 *
                 * Note: We can check present error-specific messages here if
                 * desired; either inside this 'else' or through a series of
                 * additional 'else if' statements. */
                } else {
                    ghpaAuthMessage(`Failed to load ${ghpaOrg} : ${ghpaRepo} : ${ghpaBranch} : ${ghpaFilename} as ${login} (status: ${response.status}).`);
                }
            }

            /* Save response.status so that we can check the response status
             * outside of the response function (i.e., at the end when we're
             * setting a return value for this entire function. */
            fetchResponse=response.status;
        })

        /* On an error fetching private repositoriy file, display an error
         * message. */
        .catch(function(errObject) {
            ghpaAuthMessage('ghpaRetrieve() error attempting to retrieve private content: ' + errObject.message);
            console.error(errObject);
        });
    }

    /* Return to flag whether we successfully retrieved content. */
    return (fetchResponse == 200);
}


/*============================================================================
 function htmlEncode(inputString)
------------------------------------------------------------------------------
Convert a string that is 'safe' to render in HTML.  This converst *all*
characters instead of trying to blacklist bad characters or even whitelist
good characters.
------------------------------------------------------------------------------
Arguments

inputString                         string

    The string to convert for 'safe' rendering in HTML.

------------------------------------------------------------------------------
Variables:

outputString                        string

    The encoded string, built as we go.

------------------------------------------------------------------------------
Return Value: encoded string

----------------------------------------------------------------------------*/
function htmlEncode(inputString) {
    // start with an emptry string
    let outputString = '';

    // loop through all characters, starting at the last character and
    // working backwards
    for (let index=inputString.length-1; index >= 0; index--) {

        // for each character, prepend character code to the output
        // string so far
        outputString = '&#' + inputString.charCodeAt(index) + outputString;
    }

    // return the encoded string
    return(outputString);
}

/*============================================================================
Update the Date.prottype to generate a date/time stamp formatted as:

    yyyy-mm-dd hh:mm:ss UTC[+-]hh:mm

Why?  Because I like to have date/time formatted big endian.

Call with code similar to:

    let myDate = new Date().localBigEndianFull()
----------------------------------------------------------------------------*/
Date.prototype.localBigEndianFull = function () {
    return this.getFullYear() + "-" + (this.getMonth()+1 < 10 ? "0" : "") + (this.getMonth()+1) + "-" + (this.getDate() < 10 ? "0" : "") + this.getDate() + " " + (this.getHours() < 10 ? "0" : "") + this.getHours() + ":" + (this.getMinutes() < 10 ? "0" : "") + this.getMinutes() + ":" +  (this.getSeconds() < 10 ? "0" : "") + this.getSeconds() + " UTC" + (this.getTimezoneOffset() >=0 ? "+" : "") + (Math.floor(this.getTimezoneOffset() / 60) < 10 ? "0" : "") + Math.floor(this.getTimezoneOffset() / 60) + ":" + (this.getTimezoneOffset() % 60 < 10 ? "0" : "") + (this.getTimezoneOffset() % 60);
}


/*============================================================================
Declare and define the public variables that configure the GHPA environment,
including the private GitHub organization, repository, and branch from which
we want to retrieve content.

Switch this over to a JSON configuration file later.

------------------------------------------------------------------------------
Global variables are named starting with 'ghpa'.  Local variables aren't.

Any of the variables that aren't declared as 'const' can be overridden on a
specific web page by the values in the <head> of the web page.

ghpaAuthOnlyFlag                    boolean

    Flag whether a web page that calls ghpaRetrieve() should just perform an
    authentication check (e.g., authentication-only) or should load a page
    from the private GitHub repository.

    This is set globally in this file but can be overridden on an individual
    web page, for example:

        <head><script>ghpaAuthOnlyFlag=true;</script></head>

    True:  authentication-only
    False: load a page from the private GitHub repository (recommended global
           value)

ghpaBranch                          string

    Name of the repository branch to use when accessing the private GitHub
    repository.

    This is set globally in this file but can be overridden on an individual
    web page, for example:

        <head><script>ghpaBranch='master';</script></head>

ghpaDefaultHTMLfile                 string

    Name of the file to load if ghpaRetrieve() is called with ghpaFileName
    set to a directory name or from a web page that has a
    window.location.pathname of a directory name.  In both cases, identified
    by the name ending in a '/a' character.

    This is set globally in this file but can be overridden on an individual
    web page, for example:

        <head><script>ghpaDefaultHTMLfile='index.htm';</script></head>

    Typically set to 'index.html'.

ghpaFilename                        string

    The filename to retrieve from the private GitHub repository.  This can
    optionally be set in the calling web page to specify that a specific
    file should be retrieved instead of just using the
    window.location.pathname of the current browser window.  For example:

        <head><script>ghpaFilename='getthisfile.html';</script></head>

    This is generally *not* set.

ghpaLoginFormFile                   string

    Name of the file to load HTML from to replace the HTML element ID
    ghpaLoginForm.  This can be an absolute or relative path.
    
    This is set globally in this file but can be overridden on an individual
    web page, for example:

        <head><script>ghpaLoginFormFile='/specialform.html';</script></head>

    If this variable is set to '-':
    
        <head><script>ghpaLoginFormFile='-';</script></head>
        
    then the element ghpaLoginForm isn't replaced at all.


ghpaOrg                             string

    Name of the organization to use when accessing the private GitHub
    repository.

    This is set globally in this file but can be overridden on an individual
    web page, for example:

        <head><script>ghpaOrg='scheidelg';</script></head>

ghpaOnlyGetBodyFlag                 string

    Flag whether all the retrieved content should be used, or only the content
    inside of <body></body> tags.

    True:  Only retrieved render content inside of <body>/<body> tags.
    False: Render all the retrieved content.

ghpaRepo                            string

    Name of the repository to use when accessing the private GitHub
    repository.

    This is set globally in this file but can be overridden on an individual
    web page, for example:

        <head><script>ghpaRepo='ghpa-private';</script></head>

ghpaSSOFlag                         boolean

    Flag whether a web page that calls ghpaRetrieve() should just use and save
    credentials to be used for single sign-on (SSO).  When SSO is used:

     - after successful authentication to the private GitHub repository, an
       authentication token is saved in memory

     - when attempting to access the private GitHub repository, memory is
       checked for a saved authentication token; if found, the token is used
       instead of prompting the user for authentication credentials

    This is set globally in this file but can be overridden within an
    individual web page, for example:

        <head><script>ghpSSOFlag=false;</script></head>

    True:  SSO is in use (recommended global value)
    False: SSO is not in use

ghpaTokensOnlyFlag                  boolean

    Flag whether the user should be required to use a password that matches
    the format of a GitHub personal access token string: 40 hexadecimal
    characters.

    This is set globally in this file but can be overridden on an individual
    web page, for example:

        <head><script>ghpaTokensOnlyFlag=true;</script></head>

    True:  require passwords matching the format of a personal access token
           string (recommended global value)
    False: allow any password

ghpaUserID                          boolean

    User ID retreived from sessionStorage so that web pages can display the
    'current' user for purposes of SSO.
----------------------------------------------------------------------------*/
let ghpaOrg = 'goytin';
let ghpaRepo = 'ghpa-test';
let ghpaBranch = 'main';

let ghpaDefaultHTMLfile = 'index.html';
let ghpaLoginFormFile ='/loginform.html';

/* Don't change this; it should always be empty in the global configuration.
 * It can be overridden by setting the variable on a specific public stub
 * file. */
let ghpaFilename = '';

let ghpaUserID = sessionStorage.getItem('ghpaUserID');

const ghpaTokensOnlyFlag = true;
let ghpaSSOFlag = true;
let ghpaAuthOnlyFlag = false;
let ghpaOnlyGetBodyFlag = false;
