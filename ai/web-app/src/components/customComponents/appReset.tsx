import React from "react";

/**
 * Component to reset application state, clear session and local storage
 * and redirect to index page. Classnames are used directly to prevent
 * circular dependency on tailwind. translations are also not used
 * @returns JSX.Element
*/
const AppReset = (): JSX.Element => {
  /**
   * Clears local storage and session storage and redirects to index page
   */
  const resetAppState = React.useCallback(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace( "/" );
  }, []);

  return (
    <div className="w-full h-full p-4">
      <div className="w-full p-4 px-8 bg-white rounded-md">
        <h1 className="text-2xl">Reset Application State</h1>
        <ul className="list-disc list-inside my-4">
          <li>Application unresponsive ?</li>
          <li>Stale Application State ?</li>
          <li>Features not visible after version upgrade ?</li>
          <li>Frequent application errors ?</li>
        </ul>
        <p>If you have one or more of the above issues, please click the
          <code className="bg-maize/45 px-2 mx-2 rounded-md">Reset Application</code>
            button below</p>
        <div className="flex w-full my-4 justify-end">
          <button onClick={resetAppState}
            className="bg-regalBlue/80 hover:bg-regalBlue/100 text-white p-3 rounded-md flex items-center justify-center">
                Reset Application
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppReset;