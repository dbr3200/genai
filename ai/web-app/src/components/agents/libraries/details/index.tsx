import React from "react";
import { ADPIcon, EmptyState, Spinner, Tabs } from "@amorphic/amorphic-ui-core";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Header from "../../../layout/header";
import { Content } from "../../../layout/PageLayout";
import LibraryConfiguration from "./configuration";

import { useGetLibraryDetailsQuery } from "../../../../services/agents/libraries";
import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import { getErrorMessage } from "../../../../services/helpers";
import { routeActions } from "../../../../constants";

export default function LibraryDetails(): JSX.Element {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const { libraries: librariesPath } = usePermanentPaths();
  const { resourceId = "" } = useParams<{ resourceId?: string }>();
  const { data: library, isError, isFetching, isLoading, error } = useGetLibraryDetailsQuery( resourceId, {
    skip: !resourceId
  });

  return ( <div className="adp-v2">
    <Header backBtnPath={`${librariesPath.path}/${routeActions.list}`} title={library?.LibraryName ?? t( "services.library" )} ctas={[]} />
    <Content className="flex flex-col h-full">
      <Tabs defaultActiveIndex={ hash.includes( "configuration" ) ? 1 : 0 }>
        <Tabs.Tab classes="h-full" id="Configuration" title={<div className="flex items-center gap-2">
          <ADPIcon icon="repair" size="xs" />
          <span>{t( "common.words.configuration" )}</span>
        </div>}>
          <div className="bg-white p-4 h-full flex flex-col md:flex-row gap-2 items-start">
            {isFetching || isLoading ?
              <div className="w-full h-full flex items-center justify-center"> <Spinner /> </div> :
              isError ?
                <EmptyState display="vertical" transparentBG defaultImageVariant="no-auth">
                  <EmptyState.Content title={getErrorMessage( error )} />
                </EmptyState>
                : <LibraryConfiguration libraryDetails={library} />
            }
          </div>
        </Tabs.Tab>
      </Tabs>
    </Content>
  </div> );
}