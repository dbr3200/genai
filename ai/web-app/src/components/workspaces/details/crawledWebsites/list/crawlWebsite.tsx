import React from "react";
import { Controller, useForm } from "react-hook-form";
import { TextField, Button, Toggle } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";

import { useTriggerCrawlJobMutation } from "../../../../../services/workspaces";
import { useSuccessNotification } from "../../../../../utils/hooks";
import { ComposeValidators, Validate_NumbersWithoutExponent,
  Validate_OnlyRealNumbers, Validate_Range, Validate_Required,
  Validate_URL } from "../../../../../utils/formValidationUtils";
import { LabelWithTooltip, renderError } from "../../../../../utils/renderUtils";

interface FormFields {
  IsSitemap: boolean;
  WebsiteURL: string;
  PageLimit: number;
  FollowLinks: boolean;
  }

export const CrawlWebsite = ({ workspaceId, closePanel }: { workspaceId: string, closePanel:any }): JSX.Element => {
  const { register, handleSubmit, control, formState: { errors } } = useForm<FormFields>({
    defaultValues: {
      WebsiteURL: "",
      PageLimit: 1,
      FollowLinks: false
    }
  });
  const { t } = useTranslation();
  const [ addDocument, { isLoading }] = useTriggerCrawlJobMutation();
  const [showSuccessNotification] = useSuccessNotification();

  const onSubmit = async ( values: FormFields ) => {
    const valuesCopy: any = { ...values };
    valuesCopy.PageLimit = Number( values.PageLimit );

    try {
      const { Message } = await addDocument({ id: workspaceId, requestBody: valuesCopy }).unwrap();
      showSuccessNotification({ content: Message });
      closePanel( false );
    // eslint-disable-next-line no-empty
    } catch ( e ) {
    }
  };

  return ( <form onSubmit={handleSubmit( onSubmit )} className="py-8 space-y-8">
    <div>
      <TextField
        floatingLabel={<LabelWithTooltip label={t( "services.workspaces.websiteAddress" )}
          tooltip={t( "services.workspaces.tooltip.websiteAddress" )} required />}
        {...register( "WebsiteURL", {
          validate: ( v:string ) => ComposeValidators( Validate_Required( t( "website url" )),
            Validate_URL )( v )
        })}
      />
      {renderError( errors, "WebsiteURL" )}
    </div>
    <div>
      <TextField
        floatingLabel={<LabelWithTooltip label={t( "services.workspaces.pageLimit" )}
          tooltip={t( "services.workspaces.tooltip.pageLimit" )} />}
        {...register( "PageLimit", {
          validate: ( value ) => ComposeValidators(
            Validate_OnlyRealNumbers, Validate_NumbersWithoutExponent,
            Validate_Range( 1, 500 )( t( "services.workspaces.pageLimit" ))
          )( value )
        })}
      />
      {renderError( errors, "PageLimit" )}
    </div>
    <Controller
      name="FollowLinks"
      control={control}
      defaultValue={false}
      render={({ field }) => (
        <Toggle
          label={t( "services.workspaces.followLinks" )}
          toggled={Boolean( field.value )}
          onChange={() => field.onChange( !field.value )} />
      )} />
    <div className="flex justify-end">
      <Button type="submit" loading={isLoading}>
        {t( "services.workspaces.crawlWebsite" )}
      </Button>
    </div>
  </form>
  );

};