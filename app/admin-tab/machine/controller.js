import Ember from 'ember';
import Sortable from 'ui/mixins/sortable';
import C from 'ui/utils/constants';

export default Ember.Controller.extend(Sortable, {
  application : Ember.inject.controller(),
  growl       : Ember.inject.service(),
  settings    : Ember.inject.service(),
  sortBy      : 'name',
  upgrading   : false,
  sorts       : {name: ['name']},

  actions: {
    activate: function(driver) {
      let action = null;
      if (driver.hasAction('activate')) {
        action = 'activate';
      } else if (driver.get('actionLinks.reactivate')) {
        action = 'reactivate';
      }

      driver.doAction(action);
    },
    addNewDriver: function(driver) {
      let newDriver = this.get('userStore').createRecord({
        type            : 'machineDriver',
        name            : null,
        description     : null,
        checksum        : null,
        url             : null,
        activateOnCreate: true,
      });

      if (driver) {
        newDriver.setProperties({
          name        : driver.name,
          description : driver.description,
          checksum    : driver.checksum,
          url         : driver.url,
          externalId  : driver.id,
        });
      }

      this.get('application').setProperties({
        editMachineDriver: true,
        originalModel: newDriver,
      });
    },

    addCatalogDriver: function(driver) {
      this.get('store').request({url: this.get('app.catalogEndpoint')+'/templates/'+driver.id}).then((template) =>{

        this.get('store').request({url: template.versionLinks[template.defaultVersion]}).then((driver) =>{

          let newDriver = {
            type            : 'machineDriver',
            description     : (driver.description || null),
            checksum        : (driver.files.checksum || null),
            url             : driver.files.url.replace(/[\n\r]+/g, ''),
            externalId      : driver.id,
            activateOnCreate: true,
          };

          this.get('userStore').createRecord(newDriver).save().then((result) => {
            this.get('model.drivers').pushObject(result);
          }).catch((err) => {
            this.get('growl').fromError(err);
          });

        });
      });
    },
    upgradeDriver: function(driver, version/*, path*/) {
      let templateVersion = version;

      this.set('upgrading', true);
      // find latest version of driver
      this.get('store').request({url: this.get('app.catalogEndpoint')+'/templateversions/'+driver.externalId}).then((template) => {
        this.get('store').request({url: template.upgradeVersionLinks[templateVersion]}).then((item) => {
          driver.setProperties({
            url      : item.files.url,
            checksum : item.files.checksum,
            uiUrl    : item.files.uiUrl,
          });
          driver.save().then(() => {
            this.set('upgrading', false);
          }).catch((err) => {
            this.set('upgrading', false);
            this.get('growl').fromError(err);
          });
        });
      });
    }
  },

  sortableContent: Ember.computed('model.drivers.@each', 'model.catalogDrivers.@each', function() {
    // possibly add some search here
    let cDrivers   = this.get('model.catalogDrivers.catalog');
    let drivers    = this.get('model.drivers.content');
    let newContent = [];

    cDrivers.forEach((cDriver) => {
      let check = drivers.find((driver) =>{

        if (driver.externalId && C.REMOVEDISH_STATES.indexOf(driver.get('state')) === -1) {

          let extId = driver.externalId.split(':');
          extId     = extId.slice(0, extId.length - 1).join(':');

          if (cDriver.id === extId) {
            this.get('store').request({url: this.get('app.catalogEndpoint')+'/templateversions/'+ driver.externalId}).then((upgradeInfo) => {
              if (upgradeInfo.id === driver.externalId) {
                return false;
              }
              if (upgradeInfo.upgradeVersionLinks && Object.keys(upgradeInfo.upgradeVersionLinks).length) {
                driver.set('upgradeAvailable', true);
                driver.set('upgradeVersionLinks', upgradeInfo.upgradeVersionLinks);
              }
            });

            return true;
          }
        }

        return false;
      });

      if (!check) { //not in drivers
        newContent.push(cDriver);
      }
    });

    newContent = newContent.concat(drivers);

    return newContent;
  }),

});
