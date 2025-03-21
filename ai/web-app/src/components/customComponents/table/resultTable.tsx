import React, { useState, useEffect } from "react";
import { FeatureTable, ADPIcon, Button, Tooltip } from "@amorphic/amorphic-ui-core";
// @ts-expect-error ## react-pivottable library doesn't have typescript declaration
import PivotTableUI from "react-pivottable/PivotTableUI";
import "react-pivottable/pivottable.css";
import { useTranslation } from "react-i18next";
import { useWindowSize } from "../../../utils/hooks";

import { downloadJSON } from "../../../utils";
import styles from "./styles.module.scss";

interface TableProps {
  Header?: any[];
  Rows?: any[];
  ResultsDownloadLink?: string;
  downloadWithLink?: ( val:string ) => void;
  downloadJSONResults?: boolean;
  downloadDisabled?: boolean;
}

export const FeatureTableUI = ({ Header, Rows }:TableProps ): JSX.Element => {
  const featureTableData = {
    columns: ( Header ?? []).map(( item:string ) => ({ Header: item, accessor: item })),
    data: [...( Rows ?? []).map(( item:string[]) => {
      const objToReturn:any = {};
      ( Header ?? []).map(( headerItem:string, headerIdx:number ) => {
        objToReturn[headerItem] = item[headerIdx]?.length > 20 ?
          <Tooltip size="md" trigger={<div className="space-x-2 flex items-center"><p>{item[headerIdx]?.slice( 0, 20 )}...</p>
            <ADPIcon icon="info" size="xxs" /></div>}>{item[headerIdx]}</Tooltip> : item[headerIdx];
      });
      return objToReturn;
    })]
  };
  return <div className="h-screen">
    <FeatureTable columns={featureTableData.columns} data={featureTableData.data} classes={styles.featureTable} />
  </div>;
};

const AdvancedTable = ({ Header, Rows }:TableProps ) => {
  const [ tableState, setTableState ] = useState({
    rows: Header
  });
  return <div className={styles.pivotTable}>
    <PivotTableUI
      data={[ Header, ...( Rows ?? []) ]}
      onChange={( s: any ) => setTableState( s )}
      {...tableState}
    />
  </div>;
};

export const ResultTable = (
  { Header = [], Rows = [],
    ResultsDownloadLink, downloadWithLink, downloadJSONResults = false,
    downloadDisabled = false
  }: TableProps ): JSX.Element => {
  const [ advancedMode, setAdvancedMode ] = useState( false );
  const { t } = useTranslation();
  const { width } = useWindowSize();
  const shouldRenderAdvancedMode = width >= 1024;
  useEffect(() => {
    if ( !shouldRenderAdvancedMode ){
      setAdvancedMode( false );
    }
  }, [shouldRenderAdvancedMode]);

  return (
    <>
      <div className="flex justify-between items-center">
        {t( "services.queryEngine.queryResults" )}:
        <div className="space-x-2 flex items-center">
          {shouldRenderAdvancedMode && (
            <Button
              aria-label={`Switch to ${advancedMode ? "normal" : "advanced"} mode`}
              onClick={() => setAdvancedMode( !advancedMode )}
              title={`Switch to ${advancedMode ? "normal" : "advanced"} mode`}
              variant="icon"
            >
              <ADPIcon icon="table-pivot" classes={advancedMode ? "text-amorphicBlue" : ""} size="xs" />
            </Button>
          )}
          <Button
            aria-label={t( "common.button.download" )}
            onClick={() => downloadJSONResults ? downloadJSON({ Header: Header, Rows: Rows }, "queryResult" )
              : typeof ResultsDownloadLink === "string" && downloadWithLink?.( ResultsDownloadLink )}
            title={t( "common.button.download" )}
            variant="icon"
            disabled={downloadDisabled}
          >
            <ADPIcon icon="download" size="xs" />
          </Button>
        </div>
      </div>
      {Rows?.length > 50 && <div className="flex items-center space-s-2">
        <ADPIcon icon="info" size="xs" />
        <span>{t( "services.queryEngine.max50Results" )}</span>
      </div>
      }
      <div className="mt-4">
        <div className="mt-4">
          { advancedMode ? <AdvancedTable Header={Header} Rows={ Rows?.slice( 0, 50 ) || []} />
            : <FeatureTableUI Header={Header}
              Rows={Rows?.slice( 0, 50 ) || []} />}
        </div>
      </div>
    </>
  );
};
