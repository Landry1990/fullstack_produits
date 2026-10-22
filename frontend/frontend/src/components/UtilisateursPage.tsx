import React from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '../lib/motion';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import { Users, Clock } from 'lucide-react';
import GestionUtilisateurs from './users/GestionUtilisateurs';
import UserSessions from './UserSessionsShadcn';

interface UtilisateursPageProps {
  defaultTab?: 'users' | 'sessions';
}

const UtilisateursPage: React.FC<UtilisateursPageProps> = ({ defaultTab = 'users' }) => {
  const { t } = useTranslation(['users']);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col min-h-full"
    >
      <Tabs defaultValue={defaultTab} className="flex flex-col flex-1">
        <motion.div variants={fadeInUp} className="px-6 pt-4">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              {t('page_tabs.users', 'Utilisateurs')}
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2">
              <Clock className="h-4 w-4" />
              {t('page_tabs.sessions', 'Sessions')}
            </TabsTrigger>
          </TabsList>
        </motion.div>
        <TabsContent value="users" className="flex-1 mt-0">
          <GestionUtilisateurs />
        </TabsContent>
        <TabsContent value="sessions" className="flex-1 mt-0">
          <UserSessions />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default UtilisateursPage;
