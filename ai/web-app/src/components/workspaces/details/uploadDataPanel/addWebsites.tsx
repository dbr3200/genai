import React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { TextField, Button, ADPIcon, StatusCard } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";

import { useAddWebsitesToWorkspaceMutation } from "../../../../services/workspaces";
import { useSuccessNotification } from "../../../../utils/hooks";
import { ComposeValidators, Validate_Required, Validate_URL } from "../../../../utils/formValidationUtils";
import { getObjValue } from "../../../../utils";

interface FormFields {
  IsSitemap: boolean;
  WebsiteURL: string;
  PageLimit: string;
  FollowLinks: boolean;
  WebsiteURLs: Array<{ key: string }>;
  }

  interface AddWebsitesProps {
    workspaceId: string;
    closePanel: () => void;
  }

export const AddWebsites = ({ workspaceId, closePanel }: AddWebsitesProps ): JSX.Element => {
  const { register, handleSubmit, control, formState: { errors } } = useForm<FormFields>({
    defaultValues: {
      WebsiteURLs: [{ key: "" }]
    }
  });
  const { t } = useTranslation();
  const [ addWebsites, { isLoading }] = useAddWebsitesToWorkspaceMutation();
  const [showSuccessNotification] = useSuccessNotification();

  const onSubmit = async ( values: FormFields ) => {
    const valuesCopy: any = { ...values };
    try {
      const { Message } = await addWebsites({ id: workspaceId, requestBody: { DocumentType: "website",
        DocumentDetails: {
          WebsiteURLs: valuesCopy?.WebsiteURLs?.map(( item:Record<string, any> ) => {
            return item.key;
          }) } } }).unwrap();
      showSuccessNotification({ content: Message });
      closePanel();
    // eslint-disable-next-line no-empty
    } catch ( e ) {
    }
  };

  const { fields, append, remove } = useFieldArray({
    control,
    name: "WebsiteURLs"
  });

  return ( <form onSubmit={handleSubmit( onSubmit )} className="py-4 space-y-4">
    <div className="grid gap-y-4">
      <StatusCard variant="info">
        {t( "services.workspaces.addWebsiteStatusCard" )}
      </StatusCard>
      <ul className="grid gap-y-4" id="WebsiteURLs">
        {fields.map(( item, index ) => {
          return (
            <li key={item.id} className={"flex items-start gap-2 rounded-md px-2 py-4 border-1"}>
              <div className={"flex flex-col flex-1 first:me-4"}>
                <TextField floatingLabel={<span className="requiredField">{t( "services.workspaces.WebsiteURL" )}</span>}
                  {...register( `WebsiteURLs.${index}.key`, { validate: ( val: string ) => ComposeValidators(
                    Validate_Required( t( "services.workspaces.WebsiteURL" )),
                    Validate_URL
                  )( val ) })} />
                {getObjValue( errors, `WebsiteURLs.${index}` ) &&
              <p className="text-salsa inline-block">{getObjValue( errors, `WebsiteURLs.${index}.key` )?.message}</p>
                }
              </div>
              <Button
                classes="flex-none"
                type="button" title={t( "common.button.remove" )} onClick={() => remove( index )} variant="icon"
                size="xs"
                icon={<ADPIcon filled icon="times-circle" size="xs" classes="hover:bg-salsa hover:text-white" />} />
            </li>
          );
        })}
      </ul>
      <div className="w-4">
        <Button
          type="button"
          size="xs"
          icon={<ADPIcon icon="add"
          />}
          onClick={() => {
            append({ key: "" });
          }}
        />
      </div>
    </div>
    <div className="flex justify-end">
      <Button type="submit" loading={isLoading}>
        {t( "services.workspaces.addWebsitesToWorkspaces" )}
      </Button>
    </div>
  </form>
  );

};