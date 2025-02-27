const { get } = require('mongoose');
const Alert = require('../models/alerts.model');
const Filter = require('../models/filters.model');
const { getAll } = require('./devices.controller');
const Module = require('../models/modules.model');


const compare = async function(data, device, module) {
    try {
        const filtros = await Filter.find({ device, module });
        if (!filtros || filtros.length === 0) return "No hay filtros para este dispositivo y módulo";

        const alerts = [];

        for (const filtro of filtros) {
            const value = getNestedValue(data, filtro.field);

            if (value === undefined || value === null) continue;

            for (const condition of filtro.conditions) {
                let description = null;

                // Asegurarse de que el valor de threshold sea un número
                const threshold = Number(condition.threshold);
                if (isNaN(threshold)) {
                    console.error(`Threshold no válido para la condición: ${condition.threshold}`);
                    continue;  // Si el threshold no es un número, saltamos esta condición
                }
                const moduleObj = await Module.findById(module);
                const moduleName = moduleObj.name;
                switch (condition.condition) {
                    case "<":
                        if (value < condition.threshold) {
                            description = `Alerta de ${moduleName}: ${filtro.field} menor que ${condition.threshold}, valor actual: ${value}`;
                        }
                        break;
                    case "<=":
                        if (value <= condition.threshold) {
                            description = `Alerta de ${moduleName}: ${filtro.field} menor o igual que ${condition.threshold}, valor actual: ${value}`;
                        }
                        break;
                    case "=":
                        if (value !== condition.threshold) {
                            description = `Alerta de ${moduleName}: ${filtro.field} distinto de ${condition.threshold}, valor actual: ${value}`;
                        }
                        break;
                    case ">=":
                        if (value >= condition.threshold) {
                            description = `Alerta de ${moduleName}: ${filtro.field} mayor o igual que ${condition.threshold}, valor actual: ${value}`;
                        }
                        break;
                    case ">":
                        if (value > condition.threshold) {
                            description = `Alerta de ${moduleName}: ${filtro.field} mayor que ${condition.threshold}, valor actual: ${value}`;
                        }
                        break;
                }
                

                // Si hay una descripción, crear la alerta
                if (description) {
                    const alert = await crearAlerta(description, device, module);
                    console.log('Alerta creada:', alert);  // Añadir log para depuración
                    alerts.push(alert);
                }
            }
        }

        return alerts;
    } catch (err) {
        console.error("Error al comparar y crear alertas:", err);
        throw new Error(err.message || "Ocurrió un error al crear la alerta.");
    }
};

function getNestedValue(obj, path) {
    const parts = path.split('.');
    
    // Verificamos si el primer nivel es un array (como "Sensores")
    let current = obj;
    for (let part of parts) {
        if (part.includes('[') && part.includes(']')) {
            // Si encontramos un índice en el formato "Sensores[Extractor]"
            const arrayName = part.split('[')[0];  // "Sensores"
            const key = part.split('[')[1].split(']')[0];  // "Extractor"
            
            // Accedemos al array y buscamos el objeto con el "sensor" correspondiente
            current = current[arrayName].find(item => item.sensor === key);
            if (!current) return undefined; // Si no encontramos el sensor, retornamos undefined
        } else {
            current = current[part];
        }
        if (current === undefined) return undefined;
    }
    return current;
}


const crearAlerta = async function(description, device, module) {
    const alert = new Alert({
        description,
        device,
        module
    });
    try {
        return await alert.save();
    } catch (err) {
        throw new Error("Error creating alert: " + err.message);
    }
};



const AlertsController = {
    
    getbyModule: function(req, res){
        Alert.find({module: req.body.module})
            .then(alerts => {
                res.send(alerts);
            })
            .catch(err => {
                res.status(500).send({
                    message: err.message || "Some error occurred while retrieving alerts."
                });
            });
    },
    getNotSeen: function(req, res){
        Alert.find({seen: false})
            .then(alerts => {
                res.send(alerts);
            })
            .catch(err => {
                res.status(500).send({
                    message: err.message || "Some error occurred while retrieving alerts."
                });
            });
    },
    addSeen: function(req, res){
        Alert.findByIdAndUpdate(req.body.id, {seen: true}, { useFindAndModify: false })
            .then(alert => {
                if (!alert) {
                    return res.status(404).send({
                        message: "Alert not found with id " + req.body.id
                    });
                }
                res.send(alert);
            })
            .catch(err => {
                if (err.kind === 'ObjectId') {
                    return res.status(404).send({
                        message: "Alert not found with id " + req.body.id
                    });
                }
                return res.status(500).send({
                    message: "Error updating alert with id " + req.body.id
                });
            });
        },
    addResolved: function(req, res){
        Alert.findByIdAndUpdate(req.params.id, {resolved: true}, { useFindAndModify: false })
            .then(alert => {
                if (!alert) {
                    return res.status(404).send({
                        message: "Alert not found with id " + req.body.id
                    });
                }
                res.send(alert);
            })
            .catch(err => {
                if (err.kind === 'ObjectId') {
                    return res.status(404).send({
                        message: "Alert not found with id " + req.body.id
                    });
                }
                return res.status(500).send({
                    message: "Error updating alert with id " + req.body.id
                });
            });
        },
        getbyDevice: function(req, res){
            Alert.find({device: req.body.device})
                .then(alerts => {
                    res.send(alerts);
                })
                .catch(err => {
                    res.status(500).send({
                        message: err.message || "Some error occurred while retrieving alerts."
                    });
                });
        },
        getAll: function(req, res){ 
            Alert.find()
                .then(alerts => {
                    res.send(alerts);
                })
                .catch(err => {
                    res.status(500).send({
                        message: err.message || "Some error occurred while retrieving alerts."
                    });
                });
        },
        getNotResolved: function(req, res){
            Alert.find({resolved: false})
                .then(alerts => {
                    res.send(alerts);
                })
                .catch(err => {
                    res.status(500).send({
                        message: err.message || "Some error occurred while retrieving alerts."
                    });
                });
        }
        


}
        

const filtersController ={
    create: function(req, res){
        const filter = new Filter({
            field: req.body.field,
            conditions: req.body.conditions,
            device: req.body.device,
            module: req.body.module
        });
        filter
            .save(filter)
            .then(data => {
                res.send(data);
            })
            .catch(err => {
                res.status(500).send({
                    message: err.message || "Some error occurred while creating the filter."
                });
            });
    },
    getAll: function(req, res){
        Filter.find()
            .then(filters => {
                res.send(filters);
            }
            )
            .catch(err => {
                res.status(500).send({
                    message: err.message || "Some error occurred while retrieving filters."
                });
            });
    },
    getbyModule: function(req, res){
        Filter.find({module: req.body.module})
            .then(filters => {
                res.send(filters);
            })
            .catch(err => {
                res.status(500).send({
                    message: err.message || "Some error occurred while retrieving filters."
                });
            });
    },

    getbyDevice: function(req, res){
        Filter.find({device: req.body.device})
            .then(filters => {
                res.send(filters);
            })
            .catch(err => {
                res.status(500).send({
                    message: err.message || "Some error occurred while retrieving filters."
                });
            });
    },
    modify: function(req, res){
        Filter.findByIdAndUpdate(req.body.id, req.body.filter, { useFindAndModify: false })
            .then(filter => {
                if (!filter) {
                    return res.status(404).send({
                        message: "Filter not found with id " + req.body.id
                    });
                }
                res.send(filter);
            })
            .catch(err => {
                if (err.kind === 'ObjectId') {
                    return res.status(404).send({
                        message: "Filter not found with id " + req.body.id
                    });
                }
                return res.status(500).send({
                    message: "Error updating filter with id " + req.body.id
                });
            });
        },
    getFilterbyDeviceandModule: function(req, res){
        Filter.find({device: req.body.device, module: req.body.module})
            .then(filters => {
                res.send(filters);
            })
            .catch(err => {
                res.status(500).send({
                    message: err.message || "Some error occurred while retrieving filters."
                });
            });
    },
    delete: function(req, res){
        Filter.findByIdAndRemove(req.params.id)
            .then(filter => {
                if (!filter) {
                    return res.status(404).send({
                        message: "Filter not found with id " + req.params.id
                    });
                }
                res.send({ message: "Filter deleted successfully!" });
            })
            .catch(err => {
                if (err.kind === 'ObjectId' || err.name === 'NotFound') {
                    return res.status(404).send({
                        message: "Filter not found with id " + req.params.id
                    });
                }
                return res.status(500).send({
                    message: "Could not delete filter with id " + req.params.id
                });
            });
    }
    

}


module.exports = {filtersController, AlertsController, compare};

