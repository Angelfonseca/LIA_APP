import React, { useEffect, useState } from 'react';
import apiService from '../services/api.service';
import '../assets/css/componentsCss/notification.css';

interface Alert {
    _id: string;
    description: string;
    device: string;
    module: string;
    seen: boolean;
    resolved: boolean;
    createdAt: string;
    updatedAt: string;
}

const NotificationDropdown: React.FC = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [devices, setDevices] = useState<{ [key: string]: string }>({});
    const [modules, setModules] = useState<{ [key: string]: string }>({});
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

    const unseenCount = alerts.filter(alert => !alert.seen).length;

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const data = await apiService.get<Alert[]>('/alerts/getall');
                setAlerts(data);

                const devicePromises = data.map(alert =>
                    apiService.get<{ name: string }>(`/devices/byid/${alert.device}`)
                );
                const modulePromises = data.map(alert =>
                    apiService.get<{ name: string }>(`/modules/${alert.module}`)
                );

                const [deviceResults, moduleResults] = await Promise.all([
                    Promise.all(devicePromises),
                    Promise.all(modulePromises),
                ]);

                const devicesMap: { [key: string]: string } = {};
                const modulesMap: { [key: string]: string } = {};

                data.forEach((alert, index) => {
                    devicesMap[alert.device] = deviceResults[index].name;
                    modulesMap[alert.module] = moduleResults[index].name;
                });

                setDevices(devicesMap);
                setModules(modulesMap);
            } catch (error) {
                console.error('Error fetching alerts:', error);
            }
        };

        fetchAlerts();
    }, []);

    const handleResolve = (id: string) => {
        console.log(`Resolviendo alerta con ID: ${id}`);
        setAlerts(alerts.map(alert => alert._id === id ? { ...alert, resolved: true } : alert));
        setSelectedAlert(null);
    };

    const closeModal = () => {
        setSelectedAlert(null);
    };

    const handleModalClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        e.stopPropagation();
    };

    return (
        <div className="notification-dropdown">
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="notification-button">
                Notificaciones {unseenCount > 0 && <span className="notification-badge">{unseenCount}</span>}
            </button>
            {dropdownOpen && (
                <div className="dropdown-content">
                    {alerts.length > 0 ? (
                        alerts.map(alert => (
                            <div
                                key={alert._id}
                                className={`notification-item ${alert.seen ? '' : 'unseen'}`}
                                onClick={() => setSelectedAlert(alert)}
                            >
                                <strong>{devices[alert.device] || 'Dispositivo desconocido'}</strong> -{' '}
                                {modules[alert.module] || 'Módulo desconocido'}
                                <span className="alert-description">{alert.description}</span>
                            </div>
                        ))
                    ) : (
                        <p>No hay notificaciones</p>
                    )}
                </div>
            )}
            {selectedAlert && (
                <div className="modal-backdrop" onClick={closeModal}>
                    <div className="modal-content" onClick={handleModalClick}>
                        <h3>Detalles de la Alerta</h3>
                        <p><strong>Descripción:</strong> {selectedAlert.description}</p>
                        <p><strong>Dispositivo:</strong> {devices[selectedAlert.device] || 'Desconocido'}</p>
                        <p><strong>Módulo:</strong> {modules[selectedAlert.module] || 'Desconocido'}</p>
                        <p><strong>Resuelto:</strong> {selectedAlert.resolved ? 'Sí' : 'No'}</p>
                        <p><strong>Creado:</strong> {new Date(selectedAlert.createdAt).toLocaleString()}</p>
                        <div className="action-buttons">
                            <button onClick={() => handleResolve(selectedAlert._id)}>Resolver</button>
                            <button onClick={closeModal}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
