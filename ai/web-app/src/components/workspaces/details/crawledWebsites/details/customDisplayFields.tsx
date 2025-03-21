// libraries
import React from "react";
import { Checkbox, TextCopy, Tooltip } from "@amorphic/amorphic-ui-core";

interface Props {
  changeSelectedFiles:( value:boolean, idx:number )=>void;
}

/**
 * This is a custom component for workspace crawl fields display
 * @returns {...Record<string, any>} custom field display {@link Record<string, any>}
 */
export const CustomFieldConstructor =
 ({ changeSelectedFiles
 }:Props ): Record<string, any> => {

   return {
     URL: ( data: any ) => (
       <div className="p-2">
         <div className="flex space-s-2">
           <Checkbox checked={data?.isSelected ?? false}
             onChange={() => ( changeSelectedFiles( data?.isSelected ?? false, data?.URL ))}
             classes="text-sm" />
           <Tooltip
             trigger={<div className="break-all">{data?.URL}</div>}
           >
             <TextCopy
               text={data?.URL} classes="line-clamp-2 cursor-default"
               confirmationMessage="copied"
             >
               {data?.URL}
             </TextCopy>
           </Tooltip>
         </div>
       </div>
     ),
     Indexed: ( data: any ) => (
       <div className="p-2">
         {data?.Indexed ? "Yes" : "No" }
       </div>
     )
   };
 };