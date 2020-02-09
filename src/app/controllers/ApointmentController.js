import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore } from 'date-fns';

import Apointment from '../models/Apointment';
import User from '../models/User';
import File from '../models/File';

class ApointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const apointments = await Apointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: ['date'],
      limit: 20,
      offset: (page - 1) * 20,
      attributes: ['id', 'date'],
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });

    return res.json(apointments);
  }

  async store(req, res) {
    /*
     *  Validation schema with yup
     */
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }

    /*
     *  Check if provider_id is provider
     */
    const { provider_id, date } = req.body;

    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      return res
        .status(401)
        .json({ error: 'You can only create apointments with providers' });
    }

    /*
     *  Check for past dates
     */
    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past dates are not permited' });
    }

    /*
     *  Check date availability
     */
    const checkAvailability = await Apointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res
        .status(400)
        .json({ error: 'Apointment date is not availabel.' });
    }

    /*
     *  Store on Database
     */
    const apointment = await Apointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });

    return res.json(apointment);
  }
}

export default new ApointmentController();
