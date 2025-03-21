// libraries
import React from "react";
import { ADPIcon } from "@amorphic/amorphic-ui-core";
import ReactPaginate from "react-paginate";

// methods / hooks / constants / styles
import styles from "./paginator.module.scss";

interface PaginatorProps {
    selected: number;
    pageCount: number;
    loading: boolean;
    onPageChange: ({ selected }: { selected: number }) => void;
}
const Paginator = ({
  selected = 0,
  pageCount = 0,
  loading,
  onPageChange
}: PaginatorProps ): React.ReactElement | null => {
  return ( pageCount > 0 ?
    <ReactPaginate
      className={styles.paginationContainer}
      pageClassName={styles.paginator}
      activeClassName={styles.active}
      previousLabel={<LabelButton label="prev" />}
      nextLabel={<LabelButton label="next" />}
      breakLabel="..."
      disableInitialCallback={true}
      pageCount={pageCount}
      forcePage={selected}
      marginPagesDisplayed={1}
      onPageChange={( selectedItem ) => !loading && onPageChange( selectedItem )}
    /> : null
  );
};

interface LabelButtonProps {
  /**
   * Label Type
   */
  label: "prev" | "next";
}
const LabelButton: React.FC<LabelButtonProps> = React.memo(({
  label
}: LabelButtonProps ) => {
  return <div className={styles.arrow}>
    <ADPIcon classes="mx-auto rtl:rotate-180" size="xxs" icon={
      label === "prev" ? "left-arrow" : "right-arrow"
    } />
  </div>;
});
LabelButton.displayName = "LabelButton";

export default React.memo( Paginator );