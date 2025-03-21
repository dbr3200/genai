import React from "react";
import scanDoc from "../../assets/images/docScan.gif";

export default function DocLoading() {
  return ( <div className="w-full h-full flex items-center justify-center">
    <figure>
      <img src={scanDoc} alt="Scan Doc" />
    </figure>
  </div> );
}