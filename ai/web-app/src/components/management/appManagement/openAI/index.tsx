// libraries
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { ADPIcon, Badge, Button, CTAGroup, Card, SkeletonBlock, TextCopy, TextField } from "@amorphic/amorphic-ui-core";

// components
import SidePanel from "../../../customComponents/sidePanel";

// methods / hooks / constants / styles
import { Validate_Required } from "../../../../utils/formValidationUtils";
import { renderError } from "../../../../utils/renderUtils";
import { useUpdateSystemLevelConfigMutation } from "../../../../services/management";
import { useSuccessNotification } from "../../../../utils/hooks";

interface DefaultLanguagesProps {
  openAIKey: string;
  fetchingSystemConfigs: boolean;
}

export const OpenAI = ({ openAIKey, fetchingSystemConfigs } : DefaultLanguagesProps ) : JSX.Element => {
  const { t } = useTranslation();
  const [ showEditPanel, setShowEditPanel ] = useState<boolean>( false );
  const [ updateSystemLevelConfig, { isLoading: updatingConfig }] = useUpdateSystemLevelConfigMutation();
  const [showSuccessNotification] = useSuccessNotification();

  const { formState: { errors, isDirty }, handleSubmit, register, reset } = useForm();

  const onSubmit = async ( value: any ) => {
    try {
      const { Message } = await updateSystemLevelConfig({ config: "openai-key", requestBody: value }).unwrap();
      showSuccessNotification({ content: Message });
      setShowEditPanel( false );
    // eslint-disable-next-line no-empty
    } catch ( error ) {}
  };

  useEffect(() => {
    reset({ OpenAIKey: openAIKey });
  }, [ openAIKey, reset ]);

  return <>
    <Card classes="border border-secondary-200 h-full">
      <Card.Header bordered classes="border-secondary-100">
        <Card.Title>
          <div className="flex gap-2 items-center">
            <span>
              {t( "OpenAI" )}
            </span>
          </div>
        </Card.Title>
        <Card.CTAContainer classes="border-secondary-100">
          <CTAGroup ctaList={[
            {
              callback: () => setShowEditPanel( true ),
              icon: <ADPIcon icon="edit" size="xs"/>,
              label: t( "common.button.update" )
            }
          ]} />
        </Card.CTAContainer>
      </Card.Header>
      <Card.Body>
        <div className="my-4 text-xl font-bold">
          { fetchingSystemConfigs
            ? <SkeletonBlock variant="lines" size="md" count={1}/>
            : <Badge classes="border-secondary-100 w-full" label={<span className="text-sm">OpenAI Key</span>}
              value={<TextCopy classes="text-sm" text={openAIKey ?? ""}>{openAIKey ?? ""}</TextCopy>}/>
          }
        </div>
      </Card.Body>
    </Card>
    <SidePanel
      header={t( "Update OpenAI Key" )}
      size="sm"
      show={showEditPanel}
      onClose={() => setShowEditPanel( false )}
    >
      <form onSubmit={handleSubmit( onSubmit )} className="mt-5">
        <div className="min-h-[60px]">
          <TextField
            {...register( "OpenAIKey", {
              validate: Validate_Required( t( "OpenAI Key" ))
            })}
            floatingLabel={t( "OpenAI Key" )}
            disabled={updatingConfig}
            autoFocus={true}
          />
          {renderError( errors, "OpenAIKey" )}
        </div>
        <div className="flex justify-end mt-4">
          <Button
            type="submit"
            disabled={!isDirty}
            classes="w-32"
            loading={updatingConfig}
          >
            {t( "common.button.submit" )}
          </Button>
        </div>
      </form>
    </SidePanel>
  </>;
};