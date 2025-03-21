import React, { useCallback, useEffect } from "react";
import { Spinner } from "@amorphic/amorphic-ui-core";
import configuration from "../../config.json";
import { usePermanentPaths } from "../utils/hooks/usePermanentPaths";
import jwt from "jsonwebtoken";
import { useAppSelector } from "../../utils/hooks";
import { isTruthyValue } from "../../utils";

const hasPublickey = false;

/**
 * SSOValidation method captures the code from the url query params and decodes the idToken and refreshToken
 * and updates the auth state with the decoded values.
 */

function SSOInitiate(): JSX.Element {
  // using random variable name on purpose
  const key = `${configuration.clientId}@adc`;
  const permanentPaths = usePermanentPaths();
  const { ENABLE_IDP = "no" } = useAppSelector( state => state.globalConfig );
  const isIDPLogin = isTruthyValue( ENABLE_IDP );
  const [ message, setMessage ] = React.useState<string>( "Initiating..." );
  const [ jwtToken, setJwtToken ] = React.useState<string | undefined>();

  async function fetchPublicKey( url: string ): Promise<CryptoKey> {
    try {
      return fetch( url )
        .then(( response ) => response.text())
        .then(( keyText ) => {
          const binaryData = keyText.replace( /-----BEGIN PUBLIC KEY-----/, "" )
            .replace( /-----END PUBLIC KEY-----/, "" )
            .replace( /\r?\n|\r|\s/g, "" );
          const binaryBuffer = Uint8Array.from( atob( binaryData ), ( c ) => c.charCodeAt( 0 ));

          // Import the public key using Web Crypto API
          return crypto.subtle.importKey(
            "spki",
            binaryBuffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"]
          );
        });
    } catch ( error ) {
      console.error( "Error fetching public key:", error );
      throw error;
    }
  }

  async function encryptWithPublicKey( plaintext: string, publicKey: CryptoKey ): Promise<string> {
    try {
      const dataBuffer = new TextEncoder().encode( plaintext );

      // Encrypt the data using the public key
      const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        dataBuffer
      );

      // Convert the ciphertext to a base64-encoded string
      const ciphertextString = btoa( String.fromCharCode( ...new Uint8Array( ciphertextBuffer )));
      return ciphertextString;
    } catch ( error ) {
      console.error( "Error encrypting with public key:", error );
      throw error;
    }
  }

  async function generateChecksumHash( inputString: string, salt?: string ): Promise<string> {
    setMessage( "Validating checksum" );
    const saltOrDomain = salt || window.location.origin;
    // Convert the salt and input string to Uint8Arrays
    const saltBuffer = new TextEncoder().encode( saltOrDomain );
    const dataBuffer = new TextEncoder().encode( inputString );

    // Concatenate the salt and input data
    const concatenatedBuffer = new Uint8Array( saltBuffer.length + dataBuffer.length );
    concatenatedBuffer.set( saltBuffer );
    concatenatedBuffer.set( dataBuffer, saltBuffer.length );

    // Generate the hash using SubtleCrypto (Web Crypto API)
    const hashBuffer = await crypto.subtle.digest( "SHA-256", concatenatedBuffer );

    // Convert the hash to a hexadecimal string
    const hashArray = Array.from( new Uint8Array( hashBuffer ));
    const hashString = hashArray.map( byte => byte.toString( 16 ).padStart( 2, "0" )).join( "" );

    return hashString;
  }

  const generatePayload = useCallback(( eventId: string, ciphertext?: string ) => {
    setMessage( "Generating payload" );
    let payload = {};
    generateChecksumHash( eventId ).then(( hash ) => {
      payload = {
        eventId: ciphertext || eventId,
        checksum: hash,
        iss: configuration?.VERTICAL_NAME,
        version: "1.0",
        callbackURL: window.location.origin,
        callbackPath: permanentPaths?.ssoCallback?.path
      };
      // save payload in local storage
      localStorage.setItem( "ssoPayload", JSON.stringify( eventId ));

      // convert payload to base64
      const token = jwt.sign( payload, key, {
        expiresIn: "5m",
        audience: configuration?.AMORPHIC_PORTAL_URL,
        jwtid: crypto.randomUUID()
      });
      setMessage( "Redirecting to SSO" );
      setJwtToken( token );
      //redirect to amorphic sso page with token as query param in a new tab
      window.location.replace( `${configuration?.AMORPHIC_PORTAL_URL}/authorize/sso?token=${token}` );
    });

    return payload;
  }, [ key, permanentPaths?.ssoCallback?.path ]);

  const IDPLoginDispatcher = () => {
    // setIDPLoginProgress( true );
    const idpUrl = `${
      /^((http[s]?))/.test(( configuration as any ).APP_WEB_DOMAIN )
        ? ( configuration as any ).APP_WEB_DOMAIN : `https://${( configuration as any ).APP_WEB_DOMAIN}`
    }/oauth2/authorize?identity_provider=${
      ( configuration as any ).IDENTITY_PROVIDER
    }&redirect_uri=${
      window.location.origin
    }/callback&response_type=CODE&client_id=${
      configuration.clientId
    }&scope=${( configuration as any ).TOKEN_SCOPES_ARRAY?.join( " " )}`;
    window.location.replace( idpUrl );
  };

  useEffect(() => {
    if ( isIDPLogin ) {
      IDPLoginDispatcher();
    } else {
      const eventId = crypto.randomUUID();
      const makeSSOCallWithPublicKey = async () => {
        const publicKeyUrl = "https://media-hub.amorphicdata.io/internal/public_key2.pem";
        fetchPublicKey( publicKeyUrl )
          .then( publicKey => encryptWithPublicKey( eventId, publicKey ))
          .then( ciphertext => {
            generatePayload( eventId, ciphertext );
          });
      };

      const makeSSOCall = async () => {
        generatePayload( eventId );
      };

      if ( hasPublickey ) {
        makeSSOCallWithPublicKey();
      } else {
        makeSSOCall();
      }
    }
  }, [ generatePayload, isIDPLogin ]);

  return <div className="container w-full min-h-screen flex flex-col gap-8 items-center justify-center">
    <Spinner centered size="sm" label={`${message}...`} variant="pulse" />
    { jwtToken && <div className="text-blue-500 underline">
      <a href={`${configuration?.AMORPHIC_PORTAL_URL}/authorize/sso?token=${jwtToken}`} rel="noreferrer">
        Click here if not redirected
      </a>
    </div> }
  </div>;
}

export default SSOInitiate;