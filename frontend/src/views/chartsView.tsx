import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import apiService from "../services/api.service";
import Chart from "../components/graficas"; // Importa el componente de Chart
import "../assets/css/componentsCss/chartModal.css";
import html2canvas from "html2canvas";
import "../assets/css/viewsCss/chartsView.css";

interface DataPoint {
  date: string;
  values: { 
    name: string; 
    value: number; 
    sensor: string; 
    date: string;
    rack?: string;
    granjaCamara?: string;
    originalDate?: string;
  }[];
}

interface GraphConfig {
  name: string;
  module: string;
  chartType: "bar" | "line" | "scatter";
  selectedFields: string[];
  chartData: DataPoint[];
  groupBy: string;
}

interface module {
  _id: string;
  name: string;
}

interface Modules {
  modules: module[];
}

// Nueva interfaz para el formato de los campos
interface SensorVariable {
  name: string;
  variables: string[];
}

interface FieldsResponse {
  values: SensorVariable[];
}

const ChartView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [modules, setModules] = useState<module[]>([]);
  const [selectedGraphModule, setSelectedGraphModule] = useState<string>("");
  const [groupBy, setGroupBy] = useState<string>("day");
  const [dateRange, setDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: "",
    endDate: "",
  });
  const [chartType, setChartType] = useState<"bar" | "line" | "scatter">("line");
  const [sensorVariables, setSensorVariables] = useState<SensorVariable[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [graphs, setGraphs] = useState<GraphConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isFormCollapsed, setIsFormCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const fetchModules = async () => {
      setLoading(true);
      try {
        const response = await apiService.get<Modules>(`/data/from-device/${id}`);
        setModules(response.modules || []);
      } catch (error) {
        console.error("Error fetching modules:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchModules();

    const today = new Date();
    const endDate = today.toISOString().split("T")[0];
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 1);
    setDateRange({
      startDate: startDate.toISOString().split("T")[0],
      endDate,
    });
  }, [id]);

  useEffect(() => {
    const fetchFields = async () => {
      if (!selectedGraphModule) return;
      try {
        console.log("Fetching fields for module:", selectedGraphModule);
        const response = await apiService.post<FieldsResponse>(`/data/to-graph/${id}`, {
          module: selectedGraphModule,
        });
        console.log("Fields response:", response);
        // Filtramos "rack" y "granjaCamara" de las variables de cada sensor
        const filteredSensors = response.values.map(sensor => ({
          name: sensor.name,
          variables: sensor.variables.filter(v => v !== 'rack' && v !== 'granjaCamara')
        }));
        setSensorVariables(filteredSensors);
      } catch (error) {
        console.error("Error fetching fields:", error);
      }
    };
    fetchFields();
  }, [selectedGraphModule, id]);

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setSelectedFields((prev) =>
      checked ? [...prev, value] : prev.filter((field) => field !== value)
    );
  };

  const handleAddGraph = async () => {
    if (
      !selectedGraphModule ||
      !dateRange.startDate ||
      !dateRange.endDate ||
      selectedFields.length === 0
    )
      return;
    try {
      // Transform selected fields into the format expected by the API
      // Each field is in format "sensorName.variableName"
      const fieldsForRequest = selectedFields.map(field => {
        const [sensor, variable] = field.split('.');
        return { sensor, variable };
      });

      const response = await apiService.post<DataPoint[]>(`data/range/${id}`, {
        module: selectedGraphModule,
        startDate: new Date(dateRange.startDate).toISOString(),
        endDate: new Date(dateRange.endDate).toISOString(),
        filters: fieldsForRequest,
      });
      
      console.log("API response data:", response);

      // Process the data to group by the selected option
      let processedData = response;

      // Group data based on the selected groupBy option
      processedData = groupDataByOption(processedData, groupBy);
      
      console.log("Processed data:", processedData);

      // Further process the data for display
      const chartData = processedData.map((dataPoint: DataPoint) => {
        // Group values by sensor and variable
        const groupedValues = dataPoint.values.reduce((acc: Record<string, number[]>, value) => {
          const key = `${value.sensor}.${value.name}`;
          if (!acc[key]) acc[key] = [];
          acc[key].push(value.value);
          return acc;
        }, {} as Record<string, number[]>);
  
        // Calculate statistics for each group
        const processedValues = Object.entries(groupedValues).map(([key, values]) => {
          const [sensor, variable] = key.split('.');
          const numericValues = values as number[];
          return {
            key,
            sensor,
            variable,
            min: Math.min(...numericValues),
            max: Math.max(...numericValues),
            avg: numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length,
          };
        });
  
        return {
          ...dataPoint,
          processedValues,
        };
      });
  
      console.log("Chart data:", chartData);

      const newGraphConfig: GraphConfig = {
        name: `Gráfica ${graphs.length + 1}`,
        module: selectedGraphModule,
        chartType,
        selectedFields,
        groupBy,
        chartData,
      };
  
      setGraphs((prev) => [...prev, newGraphConfig]);
    } catch (error) {
      console.error("Error fetching data by date range:", error);
    }
  };
  
  // Utility function to group data based on different options
  const groupDataByOption = (data: DataPoint[], groupBy: string): DataPoint[] => {
    if (!data || data.length === 0) return [];
    
    switch (groupBy) {
      case "raw":
        return data; // Return data as is for raw display
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
      case "rack":
        return groupByRack(data);
      case "granjaCamara":
        return groupByGranjaCamara(data);
      default:
        return data; // Return data as is if no grouping specified
    }
  };
  
  // Group by calendar day
  const groupByDay = (data: DataPoint[]): DataPoint[] => {
    const grouped = data.reduce<Record<string, DataPoint>>((acc, curr) => {
      const date = new Date(curr.date).toISOString().split("T")[0];
      if (!acc[date]) acc[date] = { date, values: [] };
      acc[date].values.push(...curr.values);
      return acc;
    }, {});
    return Object.values(grouped);
  };
  
  // Group by multiple days
  const groupByDays = (data: DataPoint[], days: number): DataPoint[] => {
    if (!data.length) return [];
    
    const grouped = data.reduce<Record<string, DataPoint>>((acc, curr) => {
      try {
        const date = new Date(curr.date);
        
        // Get the first date in the dataset for reference
        const firstDate = new Date(data[0].date);
        
        // Calculate days since the first date
        const diffTime = date.getTime() - firstDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
        
        // Calculate which group this date belongs to
        const groupIndex = Math.floor(diffDays / days);
        
        // Calculate the start date of the group (relative to the first date)
        const groupStartDate = new Date(firstDate);
        groupStartDate.setDate(firstDate.getDate() + (groupIndex * days));
        
        // Calculate the end date (making sure it doesn't exceed month boundaries)
        const groupEndDate = new Date(groupStartDate);
        groupEndDate.setDate(groupStartDate.getDate() + (days - 1));
        
        // Format the dates for display
        const startDateStr = groupStartDate.toLocaleDateString();
        const endDateStr = groupEndDate.toLocaleDateString();
        
        // Create a key for this group
        const groupKey = `${startDateStr} - ${endDateStr}`;
        
        // Add the data to the appropriate group
        if (!acc[groupKey]) {
          acc[groupKey] = { date: groupKey, values: [] };
        }
        acc[groupKey].values.push(...curr.values);
      } catch (error) {
        console.error("Error processing date:", curr.date, error);
        // Fallback - use the original date as the key
        const safeKey = curr.date || "unknown-date";
        if (!acc[safeKey]) {
          acc[safeKey] = { date: safeKey, values: [] };
        }
        acc[safeKey].values.push(...curr.values);
      }
      
      return acc;
    }, {});
    
    return Object.values(grouped);
  };
  
  // Group by month
  const groupByMonth = (data: DataPoint[]): DataPoint[] => {
    const grouped = data.reduce<Record<string, DataPoint>>((acc, curr) => {
      const date = new Date(curr.date);
      const yearMonth = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (!acc[yearMonth]) acc[yearMonth] = { date: yearMonth, values: [] };
      acc[yearMonth].values.push(...curr.values);
      return acc;
    }, {});
    return Object.values(grouped);
  };
  
  // Group by rack
  const groupByRack = (data: DataPoint[]): DataPoint[] => {
    // First flatten all values
    const allValues = data.flatMap(point => 
      point.values.map(v => ({ ...v, originalDate: point.date }))
    );
    
    // Then group by rack
    const grouped = allValues.reduce<Record<string, DataPoint>>((acc, value) => {
      const rack = value.rack || "Sin Rack";
      if (!acc[rack]) acc[rack] = { date: `Rack: ${rack}`, values: [] };
      acc[rack].values.push(value);
      return acc;
    }, {});
    
    return Object.values(grouped);
  };
  
  // Group by granjaCamara
  const groupByGranjaCamara = (data: DataPoint[]): DataPoint[] => {
    // First flatten all values
    const allValues = data.flatMap(point => 
      point.values.map(v => ({ ...v, originalDate: point.date }))
    );
    
    // Then group by granjaCamara
    const grouped = allValues.reduce<Record<string, DataPoint>>((acc, value) => {
      const granjaCamara = value.granjaCamara || "Sin Granja/Cámara";
      if (!acc[granjaCamara]) acc[granjaCamara] = { date: `Granja/Cámara: ${granjaCamara}`, values: [] };
      acc[granjaCamara].values.push(value);
      return acc;
    }, {});
    
    return Object.values(grouped);
  };

  const handleRemoveGraph = (index: number) => {
    setGraphs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDownloadGraph = async (graphConfig: GraphConfig, index: number) => {
    setIsDownloading(true);
    const chartElement = document.querySelector(`#chart-${index}`);
    if (!chartElement) {
      console.error("No se encontró el gráfico para descargar.");
      setIsDownloading(false);
      return;
    }

    try {
      // Hide buttons and scrollbars
      const buttons = chartElement.querySelectorAll("button");
      buttons.forEach((button) => (button.style.display = "none"));
      
      // Store original styles
      const originalOverflow = document.body.style.overflow;
      const chartElementOriginalOverflow = (chartElement as HTMLElement).style.overflow;
      const chartContentElement = chartElement.querySelector('.chart-content');
      const chartContentOriginalOverflow = chartContentElement ? 
        (chartContentElement as HTMLElement).style.overflow : '';
      const chartWrapperElement = chartElement.querySelector('.chart-wrapper');
      const chartWrapperOriginalOverflow = chartWrapperElement ? 
        (chartWrapperElement as HTMLElement).style.overflow : '';
      
      // Temporarily hide all scrollbars
      document.body.style.overflow = 'hidden';
      (chartElement as HTMLElement).style.overflow = 'hidden';
      if (chartContentElement) (chartContentElement as HTMLElement).style.overflow = 'hidden';
      if (chartWrapperElement) (chartWrapperElement as HTMLElement).style.overflow = 'hidden';
      
      // Create the canvas with improved settings
      const canvas = await html2canvas(chartElement as HTMLElement, {
        allowTaint: true,
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: 2, // Higher scale for better quality
        logging: false
      });
      
      // Create download link
      const imgData = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = imgData;
      a.download = `${graphConfig.module}_chart.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Restore original styles
      document.body.style.overflow = originalOverflow;
      (chartElement as HTMLElement).style.overflow = chartElementOriginalOverflow;
      if (chartContentElement) (chartContentElement as HTMLElement).style.overflow = chartContentOriginalOverflow;
      if (chartWrapperElement) (chartWrapperElement as HTMLElement).style.overflow = chartWrapperOriginalOverflow;
      buttons.forEach((button) => (button.style.display = "block"));
    } catch (error) {
      console.error("Error al convertir el gráfico a PNG:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="chart-view">
      <div className="chart-view-header">
        <h1>Dashboard de Visualización de Datos</h1>
        <p>Analice y visualice los datos de sus dispositivos en diferentes períodos de tiempo</p>
        
        <button className="collapse-toggle" onClick={() => setIsFormCollapsed(!isFormCollapsed)}>
          {isFormCollapsed ? 'Mostrar Opciones' : 'Ocultar Opciones'} 
          <i className={`fas fa-chevron-${isFormCollapsed ? 'down' : 'up'}`}></i>
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando módulos y datos...</p>
        </div>
      ) : (
        <>
          <div className={`form-container ${isFormCollapsed ? 'collapsed' : ''}`}>
            <div className="form-section">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="graphModuleSelect">Módulo</label>
                  <select
                    id="graphModuleSelect"
                    value={selectedGraphModule}
                    onChange={(e) => setSelectedGraphModule(e.target.value)}
                    className="form-control"
                  >
                    <option value="">--Seleccione un módulo--</option>
                    {modules.map((module) => (
                      <option key={module._id} value={module._id}>
                        {module.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="chartType">Tipo de Gráfica</label>
                  <select
                    id="chartType"
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value as "bar" | "line" | "scatter")}
                    className="form-control"
                  >
                    <option value="line">Línea</option>
                    <option value="bar">Barra</option>
                    <option value="scatter">Dispersión</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="groupBy">Agrupación</label>
                  <select
                    id="groupBy"
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                    className="form-control"
                  >
                    <option value="day">Por Día</option>
                    <option value="raw">Sin agrupar (Raw)</option>
                    <option value="3days">3 Días</option>
                    <option value="5days">5 Días</option>
                    <option value="7days">7 Días</option>
                    <option value="15days">15 Días</option>
                    <option value="1month">1 Mes</option>
                    <option value="rack">Por Rack</option>
                    <option value="granjaCamara">Por Granja/Cámara</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="startDate">Fecha Inicio</label>
                  <input
                    type="date"
                    id="startDate"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="endDate">Fecha Fin</label>
                  <input
                    type="date"
                    id="endDate"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                    className="form-control"
                  />
                </div>

                <div className="form-group btn-wrapper">
                  <button 
                    onClick={handleAddGraph} 
                    className="btn-primary"
                    disabled={!selectedGraphModule || !dateRange.startDate || !dateRange.endDate || selectedFields.length === 0}
                  >
                    <i className="fas fa-plus"></i> Crear Gráfica
                  </button>
                </div>
              </div>
            </div>

            {selectedGraphModule && (
              <div className="variables-selection">
                <h3>Variables a graficar</h3>
                <div className="variables-grid">
                  {sensorVariables.length > 0 ? (
                    sensorVariables.map((sensor) => (
                      <div key={sensor.name} className="sensor-card">
                        <div className="sensor-header">{sensor.name}</div>
                        <div className="variable-list">
                          {sensor.variables.map((variable) => {
                            const fieldId = `${sensor.name}.${variable}`;
                            let labelText = variable;
                            if (variable === "pot") labelText = "Potencia";
                            else if (variable === "volt") labelText = "Voltaje";
                            else if (variable === "amp") labelText = "Amperaje";
                            
                            return (
                              <div className="variable-item" key={fieldId}>
                                <input
                                  type="checkbox"
                                  id={fieldId}
                                  value={fieldId}
                                  onChange={handleFieldChange}
                                  className="variable-checkbox"
                                />
                                <label htmlFor={fieldId} className="variable-label">{labelText}</label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-variables">
                      <p>Seleccione un módulo para ver las variables disponibles</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {graphs.length > 0 ? (
            <div className="charts-grid">
              {graphs.map((graphConfig, index) => {
                const moduleName = modules.find(
                  (module) => module._id === graphConfig.module
                )?.name || "Desconocido";
                
                return (
                  <div key={index} className="chart-card" id={`chart-${index}`}>
                    <div className="chart-card-header">
                      <h3>{graphConfig.name}</h3>
                      <span className="chart-module-badge">{moduleName}</span>
                    </div>
                    
                    <div className="chart-content">
                      <Chart
                        datos={graphConfig.chartData}
                        chartType={graphConfig.chartType}
                        title={`${graphConfig.name} - ${moduleName}`}
                        selectedFields={graphConfig.selectedFields}
                        groupBy={graphConfig.groupBy}
                      />
                    </div>
                    
                    <div className="chart-actions">
                      <button
                        onClick={() => handleRemoveGraph(index)}
                        className="btn-danger"
                        disabled={isDownloading}
                      >
                        <i className="fas fa-trash-alt"></i> Eliminar
                      </button>
                      <button
                        onClick={() => handleDownloadGraph(graphConfig, index)}
                        className="btn-success"
                        disabled={isDownloading}
                      >
                        <i className="fas fa-download"></i> Descargar PNG
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-charts-message">
              <div className="empty-icon">📊</div>
              <h3>No hay gráficas para mostrar</h3>
              <p>Seleccione un módulo, configure los filtros y añada una gráfica para visualizar sus datos.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChartView;
