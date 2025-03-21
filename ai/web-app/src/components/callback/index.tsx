import * as React from "react";
import { useNavigate } from "react-router-dom";

import { completeIDPLogin } from "../../modules/auth/actions";
import { useAppDispatch } from "../../utils/hooks";
import { PageLoadSpinner } from "../pageLoadSpinner";

export const Callback = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  //Updated Callback to use a useEffect due to a warning regarding navigate

  React.useEffect(() => {
    dispatch( completeIDPLogin( navigate ));
  }, [ dispatch, navigate ]);

  return <PageLoadSpinner />;
};