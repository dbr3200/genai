export enum DisplaySizes {
    Regular = "regular",
    Wide = "wide",
    Full = "full"
}
export interface IDetailsProp {
    /**
     * FieldName is the name of the field to be displayed, ideally this should be a translation key
     */
    FieldName: string;
    /** Pass a tooltip to be shown beside the FieldName */
    Tooltip?: React.ReactNode;
    FieldValue: React.ReactChild;
    /**
     * DisplayCondition is used to show/hide the field based on condition
     * @default true
     * @type boolean
     */
    DisplayCondition?: boolean;
    /**
     * DisplaySize can be used to control the size of the panel. on details page
     * @options regular, wide, full
     * @default regular
     */
    DisplaySize?: DisplaySizes;
}

export interface IServiceDetails {
    /**
     * DisplayId can be used for mapping the widgets directly, may not be useful now until the widgets are updated.
     */
    DisplayId?: string;
    /**
     * DisplayName for the panel. This should ideally be a translation key
     * @type {string}
     * @example Dataset Details
     * @example datasets.datasetDetails.metadataPanelTitle
     * @example datasets.datasetDetails.otherOptionsPanelTitle
     */
    DisplayName: string;
     /**
     * DisplayDescription
     * @type {string}
     * @example Dataset Description
     */
     DisplayDescription?: string;
    /**
     * DisplaySize can be used to control the size of the panel. on details page
     * @options regular, wide
     * @default wide
     */
    DisplaySize: Exclude<DisplaySizes, DisplaySizes.Full>;
    darkMode?: boolean;
    /**
     * DisplayCondition can be used to control the visibility of the panel.
     * @default true
     * @type boolean
     * @condition if the fields array is empty, the panel will be hidden
     */
    DisplayCondition?: boolean;
    /**
     * HasAtomicEditOption can be used to control the visibility of the atomic edit option on the panel.
     * Always set this option to false until the atomic edit functionality is implemented.
     * @default false
     * @type boolean
     */
    HasAtomicEditOption?: boolean; // always mark false for this property until atomic updates are introduced
    /**
     * DefaultExpanded can be used to control the default expanded state of the panel.
     * @default true
     * @type boolean
     */
    DefaultExpanded?: boolean;
    Fields: IDetailsProp[];
    CustomComponent?: React.ReactNode;
    additionalCTAs?:React.ReactNode;
    sectionId: string;
}