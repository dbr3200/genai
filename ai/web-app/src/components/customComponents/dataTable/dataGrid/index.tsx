// libraries
import React from "react";
import { Badge, Card } from "@amorphic/amorphic-ui-core";

// components
import { DataTableProps } from "../index";

// methods / hooks / constants / styles
import styles from "./styles.module.scss";
import { DetailsCardSkeleton } from "../../skeletons";

type Field = {
  label:string;
  key:string;
};

type Props = Required<Pick<DataTableProps, "customFields" | "loading" | "resourcesList">> & {
  fields: Field[],
  limit: number;
};

const Grid = ({
  fields,
  customFields,
  loading,
  resourcesList,
  limit = 12
}: Props ): React.ReactElement => {

  return <div className={styles.dataGrid}>
    { loading ? [...Array( Number( limit ))].map(( _, lIdx ) => <Card key={lIdx}>
      <Card.Body><DetailsCardSkeleton /></Card.Body>
    </Card> ) : ( resourcesList?.map(
      ( item: any, rIdx: number ) => ( <Card key={rIdx} classes={styles.resourceCard}>
        <Card.Body classes={styles.resourceCardBody}>
          <div className={styles.cardTitle}>
            {/* Title/Sticky Column is rendered here. */}
            {customFields?.[fields[0].key]?.( item )}
          </div>
          <div className={styles.cardProps}>
            {/* Values taken from customFieldConstructor are rendered here. */}
            {fields
              ?.filter(({ key }: Field ) => Object.keys( customFields ).includes( key ) && key !== "options" && key !== fields[0].key )
              .map(({ label, key }:Field, index:number ) => (
                typeof customFields?.[key]?.( item )) === "string" ?
                <Badge label={`${label}`} value={customFields?.[key]?.( item ) ?? ""} key={key}/> :
                <React.Fragment key={index}>{customFields?.[key]?.( item )}
                </React.Fragment>
              )
            }
            {/* Values which are defined in the constants are taken here */}
            {fields
              ?.filter(({ key }: Field ) => !Object.keys( customFields ).includes( key ))
              .map(({ label, key }) => <Badge label={`${label ?? ""}`} value={`${item?.[key] ?? ""}`} key={key}/> )
            }
          </div>
          { customFields?.["options"] && <Card.Footer classes={styles.cardFooter}>
            { customFields?.["options"]?.( item )}
          </Card.Footer>}
        </Card.Body>
      </Card>
      )))}
  </div>;
};

export default React.memo( Grid );