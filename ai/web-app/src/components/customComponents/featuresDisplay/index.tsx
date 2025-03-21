import React from "react";
import { FallbackIfEmpty } from "../../../utils/renderUtils";
import { Label } from "@amorphic/amorphic-ui-core";
import FAIcon from "../../utils/Icon";
import clsx from "clsx";

interface IFeaturesDisplayProps {
    features: string[];
    fallback?: React.ReactChild;
    classes?: string;
}

/**
 * Switch based method to map feature name to icon
 */
const FeatureToIconMapping: Record<string, JSX.Element> = {
  FORMS: <FAIcon icon="file-lines" fixedWidth />,
  TABLES: <FAIcon icon="table" fixedWidth />,
  SIGNATURES: <FAIcon icon="signature" fixedWidth />,
  KEY: <FAIcon icon="key" fixedWidth />,
  DEFAULT: <FAIcon icon="question" fixedWidth />
};

const FeaturesDisplay = ({
  features = [],
  fallback = " - ",
  classes
}: IFeaturesDisplayProps ): JSX.Element => {
  return ( <FallbackIfEmpty data={features} fallback={fallback}>
    <div className={clsx( "flex flex-wrap gap-0.5 py-1", classes )}>
      {features?.slice()?.sort()?.map(( feature: string ) => <Label key={feature}
        classes="!text-xs border"
        variant="secondary" rounded
      >
        {FeatureToIconMapping[feature] ?? FeatureToIconMapping.DEFAULT}
        {" "}{feature}
      </Label> )}
    </div>
    {/* <AvatarGroup grouped rounded size="sm" maxItems={3}>
        {data?.Features?.slice()?.sort()?.map(( feature: string ) => <Avatar key={feature} label={feature} /> )}
      </AvatarGroup> */}
    {/* <div className="flex items-center gap-1">
        {data?.Features?.slice()?.sort()?.map(( feature: string ) => <div key={feature}
          className="border p-1 rounded-full text-secondary-300 group group-hover:bg-primary-200 group-hover:text-white"
        >
          <Tooltip trigger={
            <FAIcon key={feature} icon={FeatureToIconMapping[feature]} fixedWidth />}>
            {feature}
          </Tooltip>
        </div> )}
      </div> */}
  </FallbackIfEmpty>
  );
};

export default FeaturesDisplay;