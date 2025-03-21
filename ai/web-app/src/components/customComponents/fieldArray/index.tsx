import React from "react";
import { ADPIcon, Button, TextField, Tooltip } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import { Controller, useFieldArray } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { getObjValue } from "../../../utils";
import { ComposeValidators, Validate_Required } from "../../../utils/formValidationUtils";

import styles from "./styles.module.scss";

interface Props {
  /**
   * Label of the add field button
   */
  addLabel: string;
  /**
   * Name used for the react-hook-form field
   */
  name: string;
  register: any;
  control: any;
  label: string;
  tooltip?: React.ReactNode;
  errors: any;
  fieldArrayContainerStyles?:string;
  extraKeyValidators?: any[]
  /**
   * Used to make sure if the 2nd field needs to be unregistered or not. Defaults to unregisters.
   */
  shouldUnRegister?:boolean;
  tooltipOptions?: Omit<React.ComponentProps<typeof Tooltip>, "children" | "trigger">;
}

export const FieldArray = ({ addLabel, name, register, control, errors, label, tooltip, fieldArrayContainerStyles,
  extraKeyValidators = [],
  shouldUnRegister = true,
  tooltipOptions
}: Props ): JSX.Element => {
  const { fields, append, remove } = useFieldArray({
    control,
    name
  });
  const { t } = useTranslation();

  return (
    <section>
      <div className={clsx( styles.labelContainer, fieldArrayContainerStyles )}>
        <label className={styles.label}>{label}</label>
        {Boolean( tooltip ) && (
          <Tooltip size="md" trigger={<ADPIcon icon="info" size="xxs" />} {...tooltipOptions}>
            {tooltip}
          </Tooltip>
        )}

      </div>
      <ul id={name}>
        {fields.map(( item, index ) => {
          return (
            <li key={item.id} className={styles.listItem}>
              <div className={styles.fieldContainer}>
                <TextField floatingLabel={<span className="requiredField">{t( "common.words.key" )}</span>}
                  {...register( `${name}.${index}.key`, { validate: ( val: string ) => ComposeValidators(
                    Validate_Required( t( "common.words.key" )),
                    ...extraKeyValidators
                  )( val ) })} />
                {getObjValue( errors, `${name}.${index}.key` ) &&
              <p className="text-salsa inline-block">{getObjValue( errors, `${name}.${index}.key` )?.message}</p>
                }
              </div>
              <div className={styles.fieldContainer}>
                <Controller
                  shouldUnregister={shouldUnRegister}
                  rules={{ validate: val => Validate_Required( t( "common.words.value" ))( val ) }}
                  render={({ field }) => <TextField floatingLabel={<span className="requiredField">{t( "common.words.value" )}</span>} {...field} />}
                  name={`${name}.${index}.value`}
                  control={control}
                />
                {getObjValue( errors, `${name}.${index}.value` ) &&
              <p className="text-salsa inline-block">{getObjValue( errors, `${name}.${index}.value` )?.message}</p>
                }
              </div>
              <Button
                classes="flex-none"
                type="button" title="Remove Field" onClick={() => remove( index )} variant="icon"
                size="xs"
                icon={<ADPIcon filled icon="times-circle" size="xs" classes="hover:bg-salsa hover:text-white" />} />
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="stroked"
        size="xs"
        onClick={() => {
          append({ key: "", value: "" });
        }}
        classes="my-4 px-4 active:bg-amorphicBlue active:text-white"
      >
        {addLabel}
      </Button>
    </section>
  );
};