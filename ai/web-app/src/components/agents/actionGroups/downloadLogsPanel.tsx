import React from "react";
import { useTranslation } from "react-i18next";
import { Button, Datepicker } from "@amorphic/amorphic-ui-core";
import { Controller, useForm } from "react-hook-form";

import SidePanel from "../../customComponents/sidePanel";

import { Validate_Required } from "../../../utils/formValidationUtils";
import { renderError } from "../../../utils/renderUtils";
import { useLazyDownloadActionGroupLogsQuery } from "../../../services/agents/actionGroups";
import { convertToUTCTime, downloadWithLink } from "../../../utils";
import { useInfoNotification } from "../../../utils/hooks";

interface IProps {
    showDownloadLogsPanel: boolean;
    setShowDownloadLogsPanel: ( show: boolean ) => void;
    actionGroupId: string;
}

interface IFormState {
    startTime: Date;
    endTime: Date;
}

export const DownloadLogsPanel = ({ showDownloadLogsPanel, setShowDownloadLogsPanel, actionGroupId }: IProps ): JSX.Element => {
  const { t } = useTranslation();
  const { formState: { errors }, control, resetField, setValue, handleSubmit, watch } = useForm<IFormState>();
  const startTime = watch( "startTime" );
  const endTime = watch( "endTime" );
  const [ downloadLogs, { isLoading }] = useLazyDownloadActionGroupLogsQuery();
  const [ showInfoNotification, hideInfoNotification ] = useInfoNotification();

  const onSubmit = async ( values: IFormState ) => {
    const notificationId = showInfoNotification({ content: t( "common.messages.initiatingDownload" ), autoHideDelay: false });

    try {
      const formattedStartTime = convertToUTCTime( values.startTime, "YYYY-MM-DDThh:mm:ss" );
      const formattedEndTime = convertToUTCTime( values.endTime, "YYYY-MM-DDThh:mm:ss" );
      const { PresignedURL } = await downloadLogs({ actionGroupId, startTime: formattedStartTime, endTime: formattedEndTime }).unwrap();
      downloadWithLink( PresignedURL );
      hideInfoNotification( notificationId );
      setShowDownloadLogsPanel( false );
    } catch ( exception ) {
      hideInfoNotification( notificationId );
    }
  };

  return <SidePanel
    header ={t( "services.agents.actionGroups.downloadLogs" )}
    show={showDownloadLogsPanel} size="sm" onClose={() => setShowDownloadLogsPanel( false )}>
    <form className="flex flex-col gap-8 pt-4" onSubmit={handleSubmit( onSubmit )}>
      <div>
        <Controller
          name="startTime"
          control={control}
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          render={({ field: { ref, value, ...rest } }) => <Datepicker
            {...rest}
            selected={startTime && new Date( startTime )}
            onChange={( date: Date ) => {
              if ( !date || date > endTime ) {
                resetField( "endTime" );
              }
              setValue( "startTime", date );
            }}
            maxDate={new Date()}
            showTimeSelect
            showFullMonthYearPicker
            showYearDropdown
            dateFormat="yyyy-MM-dd HH:mm:ss"
            isClearable={false}
            floatingLabel={<span className="requiredField">{t( "services.agents.actionGroups.startTime" ) }</span>}
            disabled={isLoading}
          />}
          rules={{ validate: ( value ) => Validate_Required( t( "services.agents.actionGroups.startTime" ))( value ) }}
        />
        {renderError( errors, "startTime" )}
      </div>
      <div>
        <Controller
          name="endTime"
          control={control}
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          render={({ field: { ref, value, ...rest } }) => <Datepicker
            {...rest}
            selected={endTime && new Date( endTime )}
            onChange={( date: Date ) => setValue( "endTime", date )}
            showTimeSelect
            showFullMonthYearPicker
            showYearDropdown
            minDate={startTime}
            maxDate={new Date()}
            dateFormat="yyyy-MM-dd HH:mm:ss"
            isClearable={false}
            floatingLabel={<span className="requiredField">{t( "services.agents.actionGroups.endTime" )}</span>}
            disabled={isLoading}
          />}
          rules={{ validate: ( value ) => Validate_Required( t( "services.agents.actionGroups.endTime" ))( value ) }}
        />
        {renderError( errors, "endTime" )}
      </div>
      <div className="flex justify-end"><Button type="submit" loading={isLoading}>{t( "services.agents.actionGroups.downloadLogs" )}</Button></div>
    </form>
  </SidePanel>;
};