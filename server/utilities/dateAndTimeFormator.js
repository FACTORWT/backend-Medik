let moment = require("moment");

exports.formatDate = (dateString) => {
  const options = { year: "numeric", month: "short", day: "numeric" };
  const formattedDate = new Date(dateString).toLocaleDateString(
    "en-US",
    options
  );
  return formattedDate;
};

exports._24To12 = (time) => {
  let value = time.split(":");
  if (value[0] == "00") {
    return `12:${value[1]} PM`;
  } else if (value[0] > "12") {
    return `${+value[0] - 12}:${value[1]} PM`;
  } else return `${value[0]}:${value[1]} AM`;
};

exports.formatDateToTimeZone = (date, format, timeZone) => {
  return moment(date).tz(timeZone).format(format);
};
