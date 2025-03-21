import { SkeletonBlock } from "@amorphic/amorphic-ui-core";
import React from "react";

export default function TableLoader({
  colSpan = 1,
  rows = 5
}): React.ReactElement {
  return ( <>
    {Array.from({ length: rows }).map(( _, index ) => (
      <tr key={index}>
        <td colSpan={colSpan}>
          <SkeletonBlock variant="lineIcon" />
        </td>
      </tr>
    ))}
  </> );
}