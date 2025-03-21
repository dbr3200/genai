import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePermanentPaths } from "../utils/hooks/usePermanentPaths";

export default function Home(): JSX.Element {
  // const permanentPaths = useAppSelector(({ globalConfig }) => globalConfig?.permanentPaths );
  const { playground } = usePermanentPaths();
  const navigate = useNavigate();

  useEffect(() => {
    navigate( playground.path );
  }, [ navigate, playground ]);

  return <></>;
}
