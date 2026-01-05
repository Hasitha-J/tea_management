import { LocalNotifications } from '@capacitor/local-notifications';
import { translations } from './translations';

export const NotificationService = {
    async scheduleDailyReminder(language = 'en') {
        try {
            // Check/Request Permissions
            const permission = await LocalNotifications.checkPermissions();
            if (permission.display !== 'granted') {
                const request = await LocalNotifications.requestPermissions();
                if (request.display !== 'granted') return;
            }

            // Cancel existing reminders to avoid duplicates
            await LocalNotifications.cancel({
                notifications: [{ id: 101 }]
            });

            const title = translations[language].notifTitle || "Daily Reminder";
            const body = translations[language].notifBody || "Don't forget to log your work for today!";

            // Schedule for 5:00 PM (17:00)
            await LocalNotifications.schedule({
                notifications: [
                    {
                        title,
                        body,
                        id: 101,
                        schedule: {
                            on: {
                                hour: 17,
                                minute: 0
                            },
                            repeats: true,
                            allowWhileIdle: true
                        },
                        sound: 'default',
                        attachments: [],
                        actionTypeId: '',
                        extra: null
                    }
                ]
            });
            console.log(`Notification scheduled in ${language} for 17:00 daily`);
        } catch (error) {
            console.error('Error scheduling notification:', error);
        }
    }
};
