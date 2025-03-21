export const getInitials = ( fullName:string ): string => {
  return fullName
    ?.match( /(^\S\S?|\b\S)?/g )?.join( "" )
    ?.match( /(^\S|\S$)?/g )?.join( "" )
    ?.toUpperCase() ?? "AU";
};