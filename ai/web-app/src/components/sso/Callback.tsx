import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch } from "../../utils/hooks";
import { authActions } from "../../modules/auth/actions";
import { updateAuth } from "../../modules/auth/reducer";
import { usePermanentPaths } from "../utils/hooks/usePermanentPaths";
import { loadUserAccount } from "../../modules/account/actions";
import { Spinner } from "@amorphic/amorphic-ui-core";
import configuration from "../../config.json";
import jwt from "jsonwebtoken";
import { JwtPayload } from "jwt-decode";

interface IClaims extends JwtPayload {
    version: string;
    payload: {
        "amorphic:username": string;
        "amorphic:email": string;
        "amorphic:token": {
            value: string;
            algorithm: string;
            kid: string;
            signing_authority: string;
        },
        "amorphic:refreshToken": {
            value: string;
            algorithm: string;
            kid: string;
            signing_authority: string;
        }
    }
}

/**
 * SSOCallback method captures the code from the url query params and decodes the idToken and refreshToken
 * and updates the auth state with the decoded values.
 */

function SSOCallback(): JSX.Element {
  const dispatch = useAppDispatch();
  const [ error, setError ] = React.useState<string | undefined>();
  const [searchParams] = useSearchParams();
  const sourceToken = searchParams.get( "token" );
  const key = `${configuration.clientId}@adc`;

  async function decryptStringWithAESGCM( encryptedString: string, password: string ): Promise<string> {
    try {
      // Decode the Base64-encoded string
      const encryptedBuffer = new Uint8Array(
        atob( encryptedString )
          .split( "" )
          .map(( char ) => char.charCodeAt( 0 ))
      );

      // Extract salt, IV, and ciphertext from the buffer
      const salt = encryptedBuffer.slice( 0, 16 ); // Assuming 16-byte salt
      const iv = encryptedBuffer.slice( 16, 28 ); // Assuming 12-byte IV
      const ciphertext = encryptedBuffer.slice( 28 );

      // Convert the password to a UTF-8 encoded buffer
      const passwordBuffer = new TextEncoder().encode( password );

      // Derive a key using PBKDF2
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        { name: "PBKDF2" },
        false,
        [ "deriveBits", "deriveKey" ]
      );

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt,
          iterations: 10000, // You should use the same iteration count as in encryption
          hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 128 },
        true,
        [ "encrypt", "decrypt" ]
      );

      // Decrypt the data using AES-GCM
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv
        },
        derivedKey,
        ciphertext
      );

      // Convert the decrypted data to a string
      const decryptedString = new TextDecoder().decode( decryptedData );

      return decryptedString;
    } catch ( err ) {
      console.error( "Error decrypting string:-", err );
      setError( "Error decrypting string" );
      throw err;
    }
  }

  const permanentPaths = usePermanentPaths();
  const navigate = useNavigate();

  useEffect(() => {
    if ( sourceToken ) {
      try {
        jwt.verify( sourceToken, key, async ( err, decoded ) => {
          if ( err ) {
            console.error( "Error decoding token", err );
            setError( "Error decoding token" );
            return;
          }
          const sourceEventId = localStorage.getItem( "ssoPayload" )?.replaceAll( "\"", "" ) || "";
          const { payload } = decoded as IClaims;
          const { "amorphic:username": username, "amorphic:token": token, "amorphic:refreshToken": refreshToken } = payload;
          const decryptedIdToken = await decryptStringWithAESGCM( token.value, sourceEventId ).then( decryptedToken => decryptedToken );
          const decryptedRefreshToken = await decryptStringWithAESGCM( refreshToken.value, sourceEventId ).then( decryptedToken => decryptedToken );
          dispatch( updateAuth({
            username,
            token: decryptedIdToken,
            refreshToken: decryptedRefreshToken,
            loginStatus: authActions.LOGIN_SUCCESS,
            hasAppAccess: true,
            sessionActive: true,
            validSession: true
          }));
          username && dispatch( loadUserAccount( username, false, true ));
          navigate( permanentPaths.playground.path );
        });
      } catch ( err ) {
        console.error( "Error decoding token", err );
        setError( "Error decoding token" );
      }
    }
  }, [ dispatch, key, navigate, permanentPaths.playground.path, sourceToken ]);

  if ( !sourceToken || error ) {
    return <div className="w-screen h-screen flex items-center justify-center text-lg text-salsa">
      Invalid Claims, Please verify the code and try again !!
    </div>;
  }

  return <div className="w-screen h-screen flex items-center justify-center">
    <Spinner size="lg" label="Validating code..." />
  </div>;
}

export default SSOCallback;