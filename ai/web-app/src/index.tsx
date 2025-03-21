
// libraries
import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router } from "react-router-dom";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/es/integration/react";

// IMPORTANT: Don't change the order of import of /styles.css & /components/app
import "primereact/resources/themes/tailwind-light/theme.css";
import "primereact/resources/primereact.min.css";
import "./styles.css";

// components
import App from "./components/app";
import { ErrorBoundary } from "./components/layout/errorBoundary";

// methods / hooks / constants / styles
import "./i18n";
import { configureReduxStore } from "./store/configureStore";

export const { persistor, store } = configureReduxStore();

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <Router>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </Router>
      </PersistGate>
    </Provider>
  </React.StrictMode>,
  document.getElementById( "root" )
);

// Infer the `RootState` type from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
