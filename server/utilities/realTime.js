exports.emitEvent = (event, data = {}) => {
	factorMedicSocket.emit(event, data);
};
