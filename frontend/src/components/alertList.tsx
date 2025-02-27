// AlertList.tsx
import React, { useEffect, useState } from 'react';
import { Alert } from '../types';
import apiService from '../services/api.service';

const AlertList: React.FC = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [devices, setDevices] = useState<{ [key: string]: string }>({});
    const [modules, setModules] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        const fetchAlerts = async () => {
            const data = await apiService.get<Alert[]>('/alerts/getall');
            setAlerts(data);

            const devicePromises = data.map(alert => apiService.get<{device: any[] }>(`/devices/byid/${alert.device}`));
            const modulePromises = data.map(alert => apiService.get<{ module: any[] }>(`/modules/${alert.module}`));

            const deviceResults = await Promise.all(devicePromises);
            const moduleResults = await Promise.all(modulePromises);

            const devicesMap: { [key: string]: string } = {};
            const modulesMap: { [key: string]: string } = {};

            deviceResults.forEach((result, index) => {
                devicesMap[data[index].device] = result.name;
            });

            moduleResults.forEach((result, index) => {
                modulesMap[data[index].module] = result.name;
            });

            setDevices(devicesMap);
            setModules(modulesMap);
        };
        fetchAlerts();
    }, []);

    return (
        <div>
            <h3>Visualización de Alertas</h3>
            {alerts.map((alert, index) => (
                <div key={index} style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>
                    <p>{alert.description}</p>
                    <p>Device: {devices[alert.device]}</p>
                    <p>Module: {modules[alert.module]}</p>
                    <p>Resolved: {alert.resolved ? "Yes" : "No"}</p>
                </div>
            ))}
        </div>
    );
};

export default AlertList;
