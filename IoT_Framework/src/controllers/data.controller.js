const {modules, listModules} = require('../models/data/index');
const fs = require('fs');
const path = require('path');
const {compare} = require('./alerts.controller')
const ModulesModel = require('../models/modules.model');
const DataController = {
    fetchModules: async (req, res) => {
        try {
            const moduleList = listModules(); 
            console.log(moduleList); 
            res.json( moduleList); 
        } catch (error) {
            console.error(error); 
            res.status(500).json({ error: 'Failed to fetch modules' }); 
        }
    },
    listModules: async (req, res) => {
        try {
            const modulesList = listModules(); 
            res.json(modulesList); 
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch modules' });
        }
    },

    getAll: async (req, res) => {
        try {
            const moduleName = req.body.module; 
            const model = modules[moduleName];
            if (!model) {
                return res.status(400).json({ error: 'Invalid module name' });
            }
            const data = await model.find();
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch data' });
        }
    },

    create: async (req, res) => {
        try {
            const moduleId = req.body.module;
            const module = await ModulesModel.findById(moduleId.toString());
            const moduleName = module.name;
            const model = modules[moduleName];
            
            if (!model) {
                return res.status(400).json({ error: 'Invalid module name' });
            }
    
            const data = req.body;
            
            if (!data) {
                return res.status(400).json({ error: 'No data provided' });
            }
            const compareResults = await compare(data, req.body.device, moduleId);
            if (compareResults && compareResults.length > 0) {
                console.log("Alerts generated:", compareResults);
            }
            const newData = new model(data);
            await newData.save();
    
            res.status(201).json(newData);
        } catch (error) {
            res.status(500).json({ error: 'Failed to create data', details: error.message });
        }
    },
    

    getById: async (req, res) => {
        try {
            const moduleName = req.params.module; 
            const model = modules[moduleName];
            if (!model) {
                return res.status(400).json({ error: 'Invalid module name' });
            }
            const id = req.params.id;
            const data = await model.findById(id);
            if (!data) {
                return res.status(404).json({ error: 'Data not found' });
            }
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch data' });
        }
    },
    getModulesbyDevice: async (req, res) => {
        try {
            const modulesList = listModules(); // Llama a la función que lista los módulos
            for (const module of modulesList) {
                const model = modules[module];
                if (!model) {
                    return res.status(400).json({ error: 'Invalid module name' });
                }
                const id = req.params.id;
                const data = await model.find({ device: id });
                if (!data) {
                    return res.status(404).json({ error: 'Data not found' });
                }
                res.json(data);
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch data' });
        }

    }
    ,

    updateById: async (req, res) => {
        try {
            const moduleName = req.body.module; 
            const model = modules[moduleName];
            if (!model) {
                return res.status(400).json({ error: 'Invalid module name' });
            }
            const id = req.params.id;
            const data = req.body;
            const updatedData = await model.findByIdAndUpdate(id, data, { new: true });
            if (!updatedData) {
                return res.status(404).json({ error: 'Data not found' });
            }
            res.json({ message: 'Updated', updatedData });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update data' });
        }
    },

    deleteById: async (req, res) => {
        try {
            const moduleName = req.body.module; 
            const model = modules[moduleName];
            if (!model) {
                return res.status(400).json({ error: 'Invalid module name' });
            }
            const id = req.params.id;
            const deletedData = await model.findByIdAndDelete(id);
            if (!deletedData) {
                return res.status(404).json({ error: 'Data not found' });
            }
            res.json({ message: 'Deleted' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete data' });
        }
    },

    getDataByDateRange: async (req, res) => {
        try {
            const moduleId = req.body.module;
            const module = await ModulesModel.findById(moduleId);
            const moduleName = module.name;
            const model = modules[moduleName];
            const { startDate, endDate, filters, groupBy } = req.body;
    
            if (!model) {
                return res.status(400).json({ error: 'Invalid module name' });
            }
    
            const id = req.params.id;
    
            if (!startDate || !endDate) {
                return res.status(400).json({ error: 'Invalid date range' });
            }
    
            const data = await model.find({
                device: id,
                createdAt: { $gte: startDate, $lte: endDate },
            });
    
            if (!data || data.length === 0) {
                return res.status(404).json({ error: 'No data found for the specified range' });
            }
    
            if (!filters || filters.length === 0) {
                return res.status(400).json({ error: 'Filters are required to process the data' });
            }
    
            const selectedData = data.map(entry => {
                const values = [];
    
                filters.forEach(filter => {
                    const match = filter.match(/(.+)\[(.+)\]\.(.+)/);
                    if (match) {
                        const [, mainKey, sensorName, nestedKey] = match;
                        if (Array.isArray(entry[mainKey])) {
                            entry[mainKey].forEach(nestedObject => {
                                if (nestedObject && nestedObject.sensor === sensorName && nestedObject[nestedKey] !== undefined) {
                                    values.push({
                                        name: filter,
                                        value: nestedObject[nestedKey],
                                        sensor: sensorName,
                                        date: entry.createdAt,
                                    });
                                }
                            });
                        }
                    } else {
                        if (entry[filter] !== undefined) {
                            values.push({
                                name: filter,
                                value: entry[filter],
                                sensor: entry.Sensores?.sensor || null,
                                date: entry.createdAt,
                            });
                        }
                    }
                });
    
                return {
                    date: entry.createdAt,
                    values: values,
                };
            });
    
            const filteredSelectedData = selectedData.filter(item => item.values.length > 0);
            const aggregatedData = aggregateData(filteredSelectedData, groupBy);
    
            res.json(aggregatedData);
        } catch (error) {
            console.error('Error fetching data:', error);
            res.status(500).json({ error: 'Failed to fetch data by date range' });
        }
    },
      
    convertJson: async (req, res) => {
        const deviceId = req.params.id;
        const moduleId = req.body.module;
        const module = await ModulesModel.findById(moduleId);
        const jsonName = module.name;

    
        if (!jsonName) {
            return res.status(400).json({ error: 'No JSON name provided' });
        }
    
        const jsonFilePath = path.join(__dirname, '../../public/', `${jsonName}.json`);
    
        if (!fs.existsSync(jsonFilePath)) {
            return res.status(400).json({ error: 'JSON file not found' });
        }
    
        try {
            const dataJson = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
            if (!dataJson || typeof dataJson !== 'object') {
                return res.status(400).json({ error: 'Invalid JSON format or no data provided' });
            }
    
            if (!deviceId) {
                return res.status(400).json({ error: 'No device id provided' });
            }
            dataJson.device = deviceId.toString();
            dataJson.module = moduleId.toString();
            return res.json(dataJson);
    
        } catch (error) {
            console.error('Error processing JSON:', error);
            return res.status(500).json({ error: 'Failed to process JSON' });
        }
    },

    getMostRecentData: async (req, res) => {
        try {
            const moduleId = req.body.module; 
            console.log(moduleId);
            if (!moduleId) {
                return res.status(400).json({ error: 'No module name provided' });
            }
            const module = await ModulesModel.findById(moduleId);
            const moduleName = module.name;
            if (!moduleName) {
                return res.status(400).json({ error: 'Invalid module ID' });
            }
            const model = modules[moduleName];
            if (!model) {
                return res.status(400).json({ error: 'Invalid module name' });
            }
            const id = req.params.id;
            const data = await model.find({ device: id }).sort({ createdAt: -1 }).limit(1);
            if (!data || data.length === 0) {
                return res.status(404).json({ error: 'No recent data found' });
            }
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch most recent data' });
        }
    },
    getModulesIncludesDevice: async (req, res) => {
        const deviceId = req.params.id;
        const modulesList = await ModulesModel.find();
        const foundModules = new Set();
        if (!modulesList) {
            return res.status(400).json({ error: 'No modules found' });
        }
        try {
            for (const module of modulesList) {
                const moduleName = module.name;
                const model = modules[moduleName];
                if (!model) {
                    return res.status(400).json({ error: 'Invalid module name' });
                }
    
                const data = await model.find({ device: deviceId });
                if (data && data.length > 0) {
                    foundModules.add(module);
                }
            }
    
            if (foundModules.size > 0) {
                return res.json({ modules: Array.from(foundModules) });
            } else {
                return res.status(404).json({ error: 'No modules found with the specified device' });
            }
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch data' });
        }
    },
    getAvailableDataToGraphic: async (req, res) => {
        try {
            const moduleId = req.body.module; 
            const modelName = await ModulesModel.findById(moduleId);
            if (!modelName) {
                return res.status(400).json({ error: 'Invalid module ID' });
            }
            const model = modules[modelName.name];
            if (!model) {
                return res.status(400).json({ error: 'Invalid module name' });
            }
            const id = req.params.id;
            const data = await model.find({ device: id });
            if (!data || data.length === 0) {
                return res.status(404).json({ error: 'Data not found' });
            }
            const graphableAttributes = getGraphableAttributes(data);
    
            res.json({ graphableAttributes });
        } catch (error) {
            console.error("Error fetching data:", error);
            res.status(500).json({ error: 'Failed to fetch data' });
        }
    }
    
};
const getGraphableAttributes = (jsonData) => {
    const graphableAttributes = new Set();

    const extractAttributes = (obj, prefix = '') => {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                const fullKey = prefix ? `${prefix}.${key}` : key;

                if (typeof value === 'number') {
                    graphableAttributes.add(fullKey);
                } else if (typeof value === 'object' && value !== null) {
                    extractAttributes(value, fullKey);
                }
            }
        }
    };

    jsonData.forEach(dataEntry => {
        if (dataEntry.Sensores && Array.isArray(dataEntry.Sensores)) {
            dataEntry.Sensores.forEach(sensor => extractAttributes(sensor, 'Sensores'));
        }
    });

    return Array.from(graphableAttributes);
};
const aggregateData = (data, groupBy) => {
    switch (groupBy) {
      case "day":
        return groupByDay(data);
      case "3days":
        return groupByDays(data, 3);
      case "5days":
        return groupByDays(data, 5);
      case "7days":
        return groupByDays(data, 7);
      case "15days":
        return groupByDays(data, 15);
      case "1month":
        return groupByMonth(data);
      case "nothing":
        return data;
    }
  };
  
  // Funciones de agrupamiento ya proporcionadas
  const groupByDay = (data) => {
    const grouped = data.reduce((acc, curr) => {
      const date = new Date(curr.date).toISOString().split("T")[0];
      if (!acc[date]) acc[date] = { date, values: [] };
      acc[date].values.push(...curr.values);
      return acc;
    }, {});
    return Object.values(grouped);
  };
  
const groupByDays = (data, days) => {
    const grouped = data.reduce((acc, curr) => {
        const startDate = new Date(curr.date);
        const diffInDays = Math.floor((startDate.getTime() - new Date(data[0].date).getTime()) / (1000 * 3600 * 24));
        const groupIndex = Math.floor(diffInDays / days);
        const groupStartDate = new Date(data[0].date);
        groupStartDate.setDate(groupStartDate.getDate() + groupIndex * days);
        const groupEndDate = new Date(groupStartDate);
        groupEndDate.setDate(groupEndDate.getDate() + days - 1);
        const groupKey = `${groupStartDate.toLocaleDateString()} - ${groupEndDate.toLocaleDateString()}`;

        if (!acc[groupKey]) acc[groupKey] = { date: groupKey, values: [] };
        acc[groupKey].values.push(...curr.values);
        return acc;
    }, {});
    return Object.values(grouped);
};
  const groupByMonth = (data) => {
    const grouped = data.reduce((acc, curr) => {
      const date = new Date(curr.date);
      const yearMonth = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (!acc[yearMonth]) acc[yearMonth] = { date: yearMonth, values: [] };
      acc[yearMonth].values.push(...curr.values);
      return acc;
    }, {});
    return Object.values(grouped);
  };

module.exports = DataController;