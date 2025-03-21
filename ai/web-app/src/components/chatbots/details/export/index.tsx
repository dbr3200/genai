import React, { useState } from "react";
import { Chatbot } from "@amorphic/amorphic-chatbot";
import { Accordion, Button, Card, Select, StatusCard, TextCopy, TextField, Toggle } from "@amorphic/amorphic-ui-core";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import ScriptSection from "./ScriptSection";

import { ChatbotDetails, useUpdateChatbotMutation } from "../../../../services/chatbots";
import { useAppSelector, useSuccessNotification } from "../../../../utils/hooks";
import { LabelWithTooltip, getSelectedOptions, renderError } from "../../../../utils/renderUtils";
import { useGetWorkspacesQuery } from "../../../../services/workspaces";
import { useGetModelsQuery } from "../../../../services/models";
import { Option } from "../../../../types";

interface IExportChatbotProps {
  chatbotDetails: ChatbotDetails;
}

interface EmbeddedConfigFields {
  BotName?: string;
  BotWelcomeMessage?: string;
  BotAvatar?: string;
  Suggestions?: string[];
  SaveChatHistory: boolean;
}

const chatbotComponent = ( chatbotDetails: ChatbotDetails, API_gateway: string, ChatbotWebSocket_URL?: string ) => `<Chatbot
    chatbotId="${chatbotDetails.ChatbotId}"
    botName=${chatbotDetails?.EmbeddedConfig?.BotName ? `"${chatbotDetails?.EmbeddedConfig?.BotName}"` : "{BotName}"}
    saveChatHistory=${chatbotDetails?.EmbeddedConfig?.SaveChatHistory
    ? `"${chatbotDetails?.EmbeddedConfig?.SaveChatHistory}"` : "{SaveChatHistory}"}
    botWelcomeMessage=${chatbotDetails?.EmbeddedConfig?.BotWelcomeMessage
    ? `"${chatbotDetails?.EmbeddedConfig?.BotWelcomeMessage}"` : "{botWelcomeMessage}"}
    botAvatar=${chatbotDetails?.EmbeddedConfig?.BotAvatar ? `"${chatbotDetails?.EmbeddedConfig?.BotAvatar}"` : "{BotAvatar}"}
    apiGatewayURL="${ API_gateway || "apiGatewayURL"}"
    chatbotWebsocketURL="${ChatbotWebSocket_URL || "chatbotWebsocketURL"}"
    suggestions={[${chatbotDetails?.EmbeddedConfig?.Suggestions?.map( suggestion => `"${suggestion}"` )}]}
/>`;

const embedScript = ( chatbotId: string ) => `<script>
    window.amorphicAIChatConfig = {
      portalSource: "${window.location.origin}/embedded-chatbot/${chatbotId}"
    };
</script>
<script type="text/javascript" src="amorphic-ai-chat.min.js" defer></script>
`;

/**
 * Function to generate a downloadable javascript file
 */
const generateDownloadableFile = ( filename: string ) => {
  // eslint-disable-next-line
  const jsScript = `(function(){const w=window['amorphicAIChatConfig']||{},u={'buttonColor':'#0676E1','buttonTextColor':'#fff','buttonSize':'35','portalWidth':0x15e,'portalHeight':0x1f4,'portalSource':'https://cloudwick.com','buttonPosition':{'bottom':'0.5rem','right':'0.5rem','margin':'0.5rem'},'portalPosition':{'bottom':'0.5rem','right':'0.5rem','margin':'0.5rem'},...w};isNaN(parseInt(u['buttonSize'],0xa))?u['buttonSize']=0x23:u['buttonSize']=parseInt(u['buttonSize'],0xa);const k=document['createElement']('div');k['id']='amorphic-ai-chat-portal',k['style']['display']='none',k['style']['position']='fixed',k['style']['bottom']=u['portalPosition']['bottom'],k['style']['right']=u['portalPosition']['right'],k['style']['margin']=u['portalPosition']['margin'],k['style']['width']=u['portalWidth']+'px',k['style']['height']=u['portalHeight']+'px',k['style']['border']='1px\x20solid\x20#ccc',k['style']['borderRadius']='5px',k['style']['overflow']='hidden',k['style']['transition']='opacity\x201s\x20ease-in-out',document['body']['appendChild'](k);const n=document['createElement']('button');n['id']='amorphic-ai-chat-button',n['style']['position']='fixed',n['style']['bottom']=u['buttonPosition']['bottom'],n['style']['right']=u['buttonPosition']['right'],n['style']['margin']=u['buttonPosition']['margin'],n['style']['padding']='10px',n['style']['border']='none',n['style']['borderRadius']='50%',n['style']['backgroundColor']=u['buttonColor'],n['style']['display']='flex',n['style']['alignItems']='center',n['style']['justifyContent']='center',n['style']['boxShadow']='0\x202px\x204px\x20rgba(0,\x200,\x200,\x200.5)',n['style']['color']=u['buttonTextColor'],n['style']['cursor']='pointer',n['style']['height']=(u['buttonSize']*1.6)['toFixed'](0x0)+'px',n['style']['width']=(u['buttonSize']*1.6)['toFixed'](0x0)+'px',n['innerHTML']='<svg\x20width=\x22'+u?.['buttonSize']+'\x22\x20height=\x22'+u?.['buttonSize']+'\x22\x20viewBox=\x220\x200\x2024\x2024\x22\x20fill=\x22white\x22\x20data-adp-icon=\x22msg\x22\x20xmlns=\x22http://www.w3.org/2000/svg\x22><path\x20d=\x22M6\x209.75C6\x209.33579\x206.33579\x209\x206.75\x209H14.25C14.6642\x209\x2015\x209.33579\x2015\x209.75C15\x2010.1642\x2014.6642\x2010.5\x2014.25\x2010.5H6.75C6.33579\x2010.5\x206\x2010.1642\x206\x209.75Z\x22></path><path\x20d=\x22M6.75\x2013C6.33579\x2013\x206\x2013.3358\x206\x2013.75C6\x2014.1642\x206.33579\x2014.5\x206.75\x2014.5H18.25C18.6642\x2014.5\x2019\x2014.1642\x2019\x2013.75C19\x2013.3358\x2018.6642\x2013\x2018.25\x2013H6.75Z\x22></path><path\x20fill-rule=\x22evenodd\x22\x20clip-rule=\x22evenodd\x22\x20d=\x22M12.0556\x200C12.0491\x200.00643031\x2012.036\x200.00643031\x2012.0164\x200.00643031C5.38935\x200.00643031\x200\x205.29858\x200\x2011.806C0\x2014.4618\x200.923328\x2017.0403\x202.61282\x2019.1173L0.864392\x2023.1041C0.720327\x2023.432\x200.877489\x2023.8114\x201.20491\x2023.9465C1.32278\x2023.9979\x201.45375\x2024.0108\x201.57817\x2023.9915L7.98908\x2022.8855C9.27257\x2023.342\x2010.6215\x2023.5735\x2011.9836\x2023.5671C18.6106\x2023.5671\x2024\x2018.2749\x2024\x2011.7675C24.0131\x205.27928\x2018.663\x200.00643031\x2012.0556\x200ZM11.9902\x2022.2875C10.7263\x2022.2875\x209.47557\x2022.0624\x208.29031\x2021.6251C8.17898\x2021.5801\x208.06111\x2021.5737\x207.94324\x2021.593L2.54734\x2022.5189L3.97489\x2019.2588C4.07312\x2019.0337\x204.03383\x2018.7701\x203.87012\x2018.5836C3.0974\x2017.7026\x202.48185\x2016.6995\x202.04966\x2015.6128C1.56507\x2014.3975\x201.31623\x2013.105\x201.31623\x2011.7996C1.31623\x205.99948\x206.12278\x201.28606\x2012.0229\x201.28606C17.9099\x201.2732\x2022.6903\x205.94804\x2022.6968\x2011.7289V11.7675C22.6968\x2017.574\x2017.8903\x2022.2875\x2011.9902\x2022.2875Z\x22></path></svg>',n['addEventListener']('click',c),document['body']['appendChild'](n);const q=document['createElement']('iframe');q['id']='amorphic-ai-chat-iframe',q['src']=u['portalSource'],q['style']['width']='100%',q['style']['height']='calc(100%)',q['style']['border']='none',k['appendChild'](q);const s=document['createElement']('button');s['style']['position']='absolute',s['style']['top']='-1px',s['style']['right']='-1px',s['style']['padding']='2px',s['style']['border']='none',s['style']['display']='flex',s['style']['alignItems']='center',s['style']['justifyContent']='center',s['style']['borderRadius']='0px\x203px\x200px\x205px',s['style']['background']=u['buttonColor'],s['style']['color']=u['buttonTextColor'],s['style']['cursor']='pointer',s['innerHTML']='<svg\x20xmlns=\x22http://www.w3.org/2000/svg\x22\x20viewBox=\x220\x200\x2024\x2024\x22\x20width=\x2220\x22\x20height=\x2220\x22><path\x20fill=\x22currentColor\x22\x20d=\x22M13.414\x2012L19.707\x206.707a1\x201\x200\x200\x200-1.414-1.414L12\x2010.586\x206.707\x205.293a1\x201\x200\x200\x200-1.414\x201.414L10.586\x2012l-5.293\x205.293a1\x201\x200\x201\x200\x201.414\x201.414L12\x2013.414l5.293\x205.293a1\x201\x200\x200\x200\x201.414-1.414L13.414\x2012z\x22/></svg>',s['addEventListener']('click',c),k['appendChild'](s);function c(){k['style']['opacity']=k['style']['display']==='none'?'1':'0',k['style']['display']=k['style']['display']==='none'?'block':'none',n['style']['display']=k['style']['display']==='none'?'block':'none';}}());`;
  const element = document.createElement( "a" );
  const file = new Blob([jsScript], { type: "text/plain" });
  element.href = URL.createObjectURL( file );
  element.download = filename;
  document.body.appendChild( element ); // Required for this to work in FireFox
  element.click();
};

const EmbeddedConfigForm = ({ chatbotDetails }: { chatbotDetails: ChatbotDetails}) => {
  const { register, handleSubmit, watch, setValue, control, formState: { errors, isDirty } } = useForm<EmbeddedConfigFields>({ defaultValues: {
    ...chatbotDetails.EmbeddedConfig, SaveChatHistory: chatbotDetails.EmbeddedConfig?.SaveChatHistory?.toLowerCase() === "yes",
    Suggestions: chatbotDetails.EmbeddedConfig?.Suggestions } });
  const [ suggestionOptions, setSuggestionOptions ] =
  useState( chatbotDetails.EmbeddedConfig?.Suggestions?.map(( suggestion: string ) => ({ label: suggestion, value: suggestion })) ?? []);
  const { t } = useTranslation();
  const [showSuccessNotification] = useSuccessNotification();
  const SaveChatHistory = watch( "SaveChatHistory" );
  const [ editChatbot, { isLoading: updatingChatbot }] = useUpdateChatbotMutation();
  const { data: { Workspaces = [] } = {}, isLoading: fetchingWorkspaces } = useGetWorkspacesQuery({ projectionExpression: "WorkspaceName,WorkspaceId" });
  const { data: { Models = [] } = {}, isLoading: gettingModels } = useGetModelsQuery({ "modality": "text" });

  const updateConfig = async ( values: EmbeddedConfigFields ) => {

    const dataToSend = {
      ...chatbotDetails,
      Workspace: Workspaces.find(( workspace: { WorkspaceName: string, WorkspaceId: string }) =>
        workspace.WorkspaceName === chatbotDetails.Workspace ).WorkspaceId,
      Model: Models.find( model => model.ModelName === chatbotDetails.Model )?.ModelId,
      EmbeddedConfig: { ...values, SaveChatHistory: values.SaveChatHistory ? "yes" : "no",
        Suggestions: values.Suggestions
      }
    };

    const { data: { Message = "" } = {} }: any = await editChatbot({ id: chatbotDetails.ChatbotId, requestBody: dataToSend });
    if ( Message ) {
      showSuccessNotification({
        content: Message
      });
    }

  };

  const handleCreate = ( inputValue: string ) => {
    setSuggestionOptions(( prev ) => [ ...prev, { label: inputValue, value: inputValue }]);
    setValue( "Suggestions", [ ...( watch( "Suggestions" ) ?? []), inputValue ], { shouldDirty: true });
  };

  return <form onSubmit={handleSubmit( updateConfig )}>
    <fieldset className="flex flex-col gap-x-14 gap-y-8 p-4" disabled={updatingChatbot}>
      <h2 className="text-xl">{t( "services.chatbots.export.embeddedConfigurations" )}</h2>
      <div>
        <TextField
          {...register( "BotName" )}
          floatingLabel={t( "services.chatbots.export.CustomBotName" )}
        />
        {renderError( errors, "BotName" )}
      </div>
      <div>
        <TextField
          {...register( "BotWelcomeMessage" )}
          floatingLabel={t( "services.chatbots.export.BotWelcomeMessage" )}
        />
        {renderError( errors, "BotWelcomeMessage" )}
      </div>
      <div>
        <TextField
          {...register( "BotAvatar" )}
          floatingLabel={t( "services.chatbots.export.BotAvatarURL" )}
        />
        {renderError( errors, "BotAvatar" )}
      </div>
      <div>
        <Controller
          name="Suggestions"
          control={control}
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          render={({ field: { ref, value, ...rest }, fieldState }) => <Select
            {...rest}
            menuPortalTarget={document.body}
            floatingLabel={<LabelWithTooltip
              label={t( "services.chatbots.export.chatSuggestions" )}
              tooltip={t( "services.chatbots.export.tooltip.chatSuggestions" )} />}
            options={suggestionOptions}
            {...( value?.length ?? 0 ) === 4
              ? {
                creatable: false,
                menuIsOpen: false,
                components: { DropdownIndicator: null }
              }
              : { creatable: true }
            }
            multi={true}
            value={typeof value !== "undefined" ? getSelectedOptions( value, suggestionOptions, true ) : value}
            onChange={( options ) => {
              typeof options !== "undefined" && setValue( "Suggestions", ( options as unknown as Option[])?.map( option => option.value ),
                { shouldDirty: true });
            }}
            // Ignoring the tsc error till we correct the type definition
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            onCreateOption={handleCreate}
          />
          }
        />
      </div>

      <Toggle
        classes="w-fit"
        label={<LabelWithTooltip label={t( "services.chatbots.export.SaveChatHistory" )}
          // eslint-disable-next-line max-len
          tooltip={t( "services.chatbots.export.tooltip.SaveChatHistory" )} />}
        toggled={SaveChatHistory}
        onChange={() => setValue( "SaveChatHistory", !SaveChatHistory, { shouldDirty: true })} />
      <div className="flex justify-end">
        <Button type="submit" loading={updatingChatbot} disabled={fetchingWorkspaces || gettingModels || !isDirty}>{t( "common.button.update" )}</Button>
      </div>
    </fieldset>
  </form>;
};

const amorphicAIChatConfig = [
  {
    "property": "portalSource",
    "description": "URL of AmorphicAI gateway",
    "value": "URL",
    "required": "yes",
    "default": ""
  },
  {
    "property": "buttonColor",
    "description": "Color of the chatbot button background",
    "value": "string or Hexcode",
    "required": "no",
    "default": "#0676E1"
  },
  {
    "property": "buttonTextColor",
    "description": "Color of the chatbot button text",
    "value": "string or Hexcode",
    "required": "no",
    "default": "#ffffff"
  },
  {
    "property": "buttonSize",
    "description": "Size value for the chatbot button",
    "value": "number",
    "required": "no",
    "default": "35"
  },
  {
    "property": "portalWidth",
    "description": "Height of the chat window",
    "value": "number",
    "required": "no",
    "default": "350"
  },
  {
    "property": "portalHeight",
    "description": "Width of the chat window",
    "value": "number",
    "required": "no",
    "default": "500"
  },
  {
    "property": "buttonPosition",
    "description": "Location of the chatbot button",
    "value": "Object with bottom, right and margin values",
    "required": "no",
    "default": "{ bottom: '0.5rem', right: '0.5rem', margin: '0.5rem' }"
  },
  {
    "property": "portalPosition",
    "description": "Locatio of the chat window",
    "value": "Object with bottom, right and margin values",
    "required": "no",
    "default": "{ bottom: '0.5rem', right: '0.5rem', margin: '0.5rem' }"
  }
];

const ExportChatbot = ({
  chatbotDetails
}: IExportChatbotProps ): JSX.Element => {
  const { API_gateway, ChatbotWebSocket_URL } = useAppSelector( state => state.globalConfig );

  return chatbotDetails?.KeepActive
    ? <div className="w-full grid grid-cols-2 gap-4">

      <div className="w-full flex flex-col gap-4">
        <Card classes="w-full">
          <EmbeddedConfigForm chatbotDetails={chatbotDetails} />
        </Card>

        <Accordion>
          <Accordion.Header classes="text-xl">Direct Link</Accordion.Header>
          <Accordion.Body classes="!bg-white">
            <div className="flex flex-row gap-4">
              <a href={
                `${window.location.origin}/embedded-chatbot/${chatbotDetails?.ChatbotId}`
              } target="_blank" rel="noreferrer" className="text-primary-200 hover:underline">
                {`${window.location.origin}/embedded-chatbot/${chatbotDetails?.ChatbotId}`}
              </a>
              <TextCopy text={`${window.location.origin}/embedded-chatbot/${chatbotDetails?.ChatbotId}`}>
                {"-"}
              </TextCopy>
            </div>
          </Accordion.Body>
        </Accordion>
        <Accordion>
          <Accordion.Header classes="text-xl">React Component</Accordion.Header>
          <Accordion.Body classes="!bg-white">
            <div className="flex flex-col gap-4">
              <section>
                <p>Add <code className="bg-orange-200 p-1 rounded-md">&lt;Chatbot/&gt;</code> component</p>
                <ScriptSection text="npm install @amorphic/amorphic-chatbot" />
              </section>
              <section className="flex flex-col gap-2">
                <p>Import <code className="bg-orange-200 p-1 rounded-md">&lt;Chatbot/&gt;</code> component</p>
                <ScriptSection text="import { Chatbot } from '@amorphic/amorphic-chatbot';" />
                <p>Configure <code className="bg-orange-200 p-1 rounded-md">&lt;Chatbot/&gt;</code> component</p>
                <ScriptSection text={chatbotComponent( chatbotDetails, API_gateway, ChatbotWebSocket_URL )} />
              </section>
            </div>
          </Accordion.Body>
        </Accordion>
        <Accordion>
          <Accordion.Header classes="text-xl">Embed</Accordion.Header>
          <Accordion.Body classes="!bg-white">
            <section>
              <p>Download the file&nbsp;
                <button className="text-primary-200 hover:underline hover:cursor-pointer"
                  onClick={() => generateDownloadableFile( "amorphic-ai-chat.min.js" )}
                >
            amorphic-ai-chat.min.js
                </button> and then copy the following code to your website.
              </p>
              <ScriptSection text={embedScript( chatbotDetails?.ChatbotId )} />
            </section>
            <section className="w-full my-8 flex flex-col gap-4">
              <h3 className="text-lg">amorphicAIChatConfig Options</h3>
              <table className="table table-fixed w-full border">
                <thead>
                  <tr className="bg-primary-300 text-secondary-100 p-2">
                    <th className="px-4 py-2">Property Name</th>
                    <th className="px-4 py-2">Value</th>
                    <th className="px-4 py-2">Required</th>
                    <th className="px-4 py-2">Default</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100">
                  {amorphicAIChatConfig?.map( prop => <tr key={prop.property}>
                    <td className="px-4 py-2 flex flex-col">
                      <span className="font-semibold">{prop.property}</span>
                      <span className="text-sm text-secondary-150">{prop.description}</span>
                    </td>
                    <td className="px-4 py-2">{prop.value}</td>
                    <td className="px-4 py-2">{prop.required}</td>
                    <td className="px-4 py-2">
                      <div className="whitespace-pre-line">
                        {prop.default}
                      </div>
                    </td>
                  </tr> )}
                </tbody>
              </table>
            </section>
          </Accordion.Body>
        </Accordion>

      </div>
      <Card classes="w-full max-h-[70vh]">
        <div className="h-full flex flex-col">
          <h2 className="text-xl px-4 pt-4">Preview</h2>
          <Chatbot
            chatbotId={chatbotDetails.ChatbotId}
            botName={chatbotDetails?.EmbeddedConfig?.BotName}
            saveChatHistory={chatbotDetails?.EmbeddedConfig?.SaveChatHistory ?? "no"}
            botWelcomeMessage={chatbotDetails?.EmbeddedConfig?.BotWelcomeMessage}
            botAvatar={chatbotDetails?.EmbeddedConfig?.BotAvatar}
            apiGatewayURL={API_gateway}
            chatbotWebsocketURL={ChatbotWebSocket_URL}
            suggestions={chatbotDetails?.EmbeddedConfig?.Suggestions}
          />
        </div>
      </Card>

    </div>
    : <StatusCard variant="warning">
      The Chatbot is inactive. To use it in an external application please update the Chatbot and set &apos;KeepActive&apos; to True.
    </StatusCard>;
};

export default ExportChatbot;