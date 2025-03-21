// libraries
import React from "react";
import { SkeletonBlock } from "@amorphic/amorphic-ui-core";

// components
import { DataTableProps } from "../index";

// methods / hooks / constants / styles
import styles from "./styles.module.scss";

type Field = {
  label:string;
  key:string;
};

type Props = Required<Pick<DataTableProps, "customFields" | "loading" | "resourcesList">> & {
  fields: Field[];
  limit: number;
};

const Table = ({
  fields,
  customFields,
  resourcesList,
  loading,
  limit = 12
}: Props ): JSX.Element => {
  return <table className={styles.dataTable}>
    <thead>
      <tr>
        {fields.map(( item: Field ) => <td key={item.key}>
          <div>{item?.label || item?.key}</div>
        </td>
        )}
      </tr>
    </thead>
    <tbody>
      {loading ? (
        <tr>
          <td className={styles.skeletonBlock} colSpan={fields.length}>
            <SkeletonBlock variant="table" rows={Number( limit )} count={fields.length} />
          </td>
        </tr>
      ) : ( resourcesList.map(( item: any, rIdx: number ) => (
        <tr key={rIdx}>
          {fields.map(({ key }: Field, fieldIndex: number ) => <td key={fieldIndex}>
            <div>
              {customFields[key]
                ? customFields[key]?.( item )
                : item[key]}
            </div>
          </td>
          )}
        </tr>
      ))
      )}
    </tbody>
  </table>;
};

export default React.memo( Table );