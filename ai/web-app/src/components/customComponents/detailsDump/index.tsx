import React from "react";
import { deleteObjKey, flatter } from "../../../utils";
import { DetailsTable } from "../table/DetailsTable";

interface IDetailsDumpProps {
    object: {
        [key: string]: any;
    },
    /** An array of keys that need to be excluded. For nested keys pass a dot separated path Ex - "parentKey.childKey" */
    excludeKeys?: string[],
    extraKeys?: [string, any][]
}

const DetailsDump = ({ object, excludeKeys, extraKeys }: IDetailsDumpProps ): JSX.Element => {
  const objCopy = structuredClone( object );
  excludeKeys?.forEach(( key: string ) => {
    deleteObjKey( objCopy, key );
  });

  const curatedData = objCopy ? Object.keys( objCopy )
    .reduce(( a: any[], c: string ) => a.concat( flatter({ c, val: objCopy[c] ? ( objCopy[c] || String( objCopy[c])) || "-" : "-" })), []) : [];
  extraKeys && curatedData.push( ...extraKeys.filter(( item ) => item[0] !== "" ));
  return <div className="flex w-full">
    <DetailsTable componentArray={curatedData} tdClasses={[ "break-words", "break-words" ]}/>
  </div>;
};

export default DetailsDump;