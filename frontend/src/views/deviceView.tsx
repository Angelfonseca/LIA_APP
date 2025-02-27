import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactJson from "react-json-view";
import apiService from "../services/api.service";
import "../assets/css/viewsCss/deviceView.css";

interface ModuleData {
  name: string;
  _id: string;
}

const DeviceView: React.FC = () => {
  const { id } = useParams<Record<string, string | undefined>>();
  const navigate = useNavigate(); // hook para redirección
  const [generalModules, setGeneralModules] = useState<ModuleData[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>("");  // Para "Generar JSON para POST"
  const [jsonResponse, setJsonResponse] = useState<Record<string, unknown> | null>(null);  // Respuesta para el módulo general
  const [selectedModuleForLatestData, setSelectedModuleForLatestData] = useState<string>("");  // Para "Ver datos más recientes"
  const [latestDataResponse, setLatestDataResponse] = useState<Record<string, unknown> | null>(null);  // Respuesta para los datos más recientes

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await apiService.get<{ modules: ModuleData[] }>("/modules");
        console.log("General Modules:", response);
        if (response.modules.length === 0) return;
        setGeneralModules(response.modules);
      } catch (error) {
        console.error("Error fetching general modules:", error);
      }
    };

    const fetchDataModule = async () => {
      try {
        const response = await apiService.post(`/data/from-device/${id}`, {});
        console.log("Módulos obtenidos:", response);
        setGeneralModules(response.modules);
      } catch (error) {
        console.error("Error obteniendo los módulos:", error);
      }
    };

    fetchModules();
    if (id) fetchDataModule();
  }, [id]);

  const handleModuleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModule(e.target.value);
  };

  const handlePostRequest = async () => {
    try {
      const requestBody = { module: selectedModule };
      const response = await apiService.post(`/data/json/${id}`, requestBody);
      setJsonResponse(response);  // Almacenar la respuesta en jsonResponse
      alert("Request successfully sent");
    } catch (error) {
      console.error("Error sending POST request:", error);
    }
  };

  const handleGetLatestData = async () => {
    try {
      const requestBody = { module: selectedModuleForLatestData };
      const response = await apiService.post(`/data/latest/${id}`, requestBody);
      setLatestDataResponse(response);  // Almacenar la respuesta en latestDataResponse
      alert("Datos más recientes obtenidos correctamente");
    } catch (error) {
      console.error("Error obteniendo datos más recientes:", error);
    }
  };

  const handleRedirectToGraphs = () => {
    navigate(`/graficas/${id}`);
  };

  return (
    <div className="device-view-container">
      <h1>Device ID: {id}</h1>
      <div className="layout">
        {/* Sección de Módulos Generales */}
        <div className="module-section">
          <h2>Generar JSON para POST</h2>
          <div className="json-display">
            {jsonResponse ? (
              <ReactJson src={jsonResponse} theme="monokai" collapsed={false} />
            ) : (
              <p>No se ha hecho ninguna petición aún.</p>
            )}
          </div>
          <label htmlFor="moduleSelect">Selecciona un módulo:</label>
          <select
            id="moduleSelect"
            value={selectedModule}
            onChange={handleModuleChange}
            className="module-select"
          >
            <option value="">--Selecciona un módulo--</option>
            {generalModules.length > 0 ? (
              generalModules.map((module, index) => (
                <option key={index} value={module._id}>
                  {module.name}
                </option>
              ))
            ) : (
              <option value="">Cargando módulos...</option>
            )}
          </select>
          {selectedModule && (
            <div className="button-group">
              <button onClick={handlePostRequest} className="btn btn-green">
                Obtener Json para post de datos
              </button>
            </div>
          )}
        </div>

        {/* Sección de Datos más recientes */}
        <div className="chart-section">
          <button onClick={handleRedirectToGraphs} className="btn btn-orange">
            Ir a Gráficas
          </button>

          <label htmlFor="data">Selecciona un módulo para los datos más recientes:</label>
          <select
            id="data"
            value={selectedModuleForLatestData}
            onChange={(e) => setSelectedModuleForLatestData(e.target.value)}
            className="module-select"
          >
            <option value="">--Selecciona un módulo--</option>
            {generalModules.length > 0 ? (
              generalModules.map((module, index) => (
                <option key={index} value={module._id}>
                  {module.name}
                </option>
              ))
            ) : (
              <option value="">Cargando módulos...</option>
            )}
          </select>

          {selectedModuleForLatestData && (
            <div className="button-group">
              <button onClick={handleGetLatestData} className="btn btn-blue">
                Ver datos más recientes
              </button>
            </div>
          )}

          <div className="json-display">
            {latestDataResponse ? (
              <ReactJson src={latestDataResponse} theme="monokai" collapsed={false} />
            ) : (
              <p>No se ha obtenido datos recientes.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceView;
